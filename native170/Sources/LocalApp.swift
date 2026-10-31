import SwiftUI
import WebKit
import Network
import Security
import AVFoundation
import CoreLocation
import Photos
import UserNotifications
import WebRTC

final class MushuiNotificationDelegate:NSObject,UNUserNotificationCenterDelegate {
 func userNotificationCenter(_ center:UNUserNotificationCenter,willPresent notification:UNNotification,withCompletionHandler completionHandler:@escaping(UNNotificationPresentationOptions)->Void){completionHandler([.banner,.list,.sound,.badge])}
}
let mushuiNotificationDelegate=MushuiNotificationDelegate()

func startupTrace(_ event:String){
 let url=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0].appendingPathComponent("startup-trace.json");var values=(try? Data(contentsOf:url)).flatMap{try? JSONSerialization.jsonObject(with:$0)} as? [String] ?? [];values.append(event);if let data=try? JSONSerialization.data(withJSONObject:values){try? data.write(to:url)}
}
final class LocalServer {
 let listener:NWListener;let queue=DispatchQueue(label:"mushui.local.http");let root:URL;let report:(String)->Void
 init(ready:@escaping(URL)->Void,failed:@escaping(String)->Void,report:@escaping(String)->Void)throws{guard let bundled=Bundle.main.url(forResource:"www",withExtension:nil) else{throw NSError(domain:"MushuiStartup",code:1,userInfo:[NSLocalizedDescriptionKey:"安裝包缺少介面檔案"])};root=bundled.standardizedFileURL;self.report=report;let p=NWParameters.tcp;p.requiredLocalEndpoint = .hostPort(host:"127.0.0.1",port:.any);listener=try NWListener(using:p);listener.stateUpdateHandler={ [weak self] state in if case .ready=state,let port=self?.listener.port{ready(URL(string:"http://127.0.0.1:\(port.rawValue)/index.html")!)};if case .failed(let error)=state{failed(error.localizedDescription)} };listener.newConnectionHandler={ [weak self] c in guard let self else{c.cancel();return};c.start(queue:self.queue);self.read(c,Data()) };listener.start(queue:queue)}
 func read(_ c:NWConnection,_ prior:Data){c.receive(minimumIncompleteLength:1,maximumLength:65536){[weak self] data,_,done,error in guard let self else{return};var all=prior;if let data{all.append(data)};if all.count>65536{self.report("oversized HTTP request");c.cancel();return};guard let header=String(data:all,encoding:.utf8),header.contains("\r\n\r\n") else{if done||error != nil{c.cancel()}else{self.read(c,all)};return};let parts=header.components(separatedBy:"\r\n")[0].split(separator:" ");guard parts.count>=2,parts[0]=="GET"||parts[0]=="HEAD",let url=URL(string:"http://localhost"+String(parts[1])) else{self.report("malformed HTTP request");c.cancel();return};let requestPath=String(parts[1]);let file=self.root.appendingPathComponent(url.path=="/" ? "index.html":String(url.path.dropFirst())).standardizedFileURL;let rootPath=self.root.resolvingSymlinksInPath().path;let filePath=file.resolvingSymlinksInPath().path;let rootBoundary=rootPath.hasSuffix("/") ? rootPath:rootPath+"/";let valid=filePath.hasPrefix(rootBoundary);let bytes=valid ? (try? Data(contentsOf:file)):nil;let status=bytes==nil ? "404":"200",body=bytes ?? Data();let ext=file.pathExtension.lowercased(),mime=["html":"text/html; charset=utf-8","js":"application/javascript; charset=utf-8","css":"text/css; charset=utf-8","png":"image/png","gif":"image/gif","ttf":"font/ttf","webmanifest":"application/manifest+json"][ext] ?? "application/octet-stream";let name=url.lastPathComponent; if status != "200" || ["index.html","client-config.js","ios-host.js","host.js","web-store.js","app.js"].contains(name){self.report("http \(parts[0]) \(requestPath) -> \(status) \(body.count)B \(mime)")};var result=Data("HTTP/1.1 \(status == "200" ? "200 OK":"404 Not Found")\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n".utf8);if parts[0] != "HEAD"{result.append(body)};c.send(content:result,contentContext:.finalMessage,isComplete:true,completion:.contentProcessed({error in if error != nil{c.cancel()}else{c.receive(minimumIncompleteLength:1,maximumLength:1){_,_,_,_ in c.cancel()};self.queue.asyncAfter(deadline:.now()+10){c.cancel()}}}))}}
}
final class NoRedirect:NSObject,URLSessionTaskDelegate{func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void){completionHandler(nil)}}
@MainActor final class AppModel:ObservableObject {
 @Published var url:URL?
 @Published var ready=false
 @Published var error=""
 @Published var diagnostic=""
 @Published var generation=0
 let calls=NativeCalls()
 var server:LocalServer?
 weak var host:Host?
 private var attempts=0
 var qaRound=0
 init(){start()}
 func start(){startupTrace("start");ready=false;error="";diagnostic="";url=nil;generation+=1;server?.listener.cancel();server=nil
  let current=generation;DispatchQueue.main.asyncAfter(deadline:.now()+15){[weak self] in guard let self,self.generation==current,self.url==nil,self.error.isEmpty else{return};self.fail("本機畫面服務未就緒，請重新載入。")};do{server=try LocalServer(ready:{[weak self] url in Task{@MainActor in startupTrace("listener-ready");self?.url=url}},failed:{[weak self] error in Task{@MainActor in self?.fail("本機介面服務無法啟動："+error)}},report:{[weak self] line in Task{@MainActor in self?.recordDiagnostic(line)}})}catch{fail(error.localizedDescription)}
 }
 func fail(_ message:String){startupTrace("failure:"+message);ready=false;error=message}
 func recordDiagnostic(_ message:String){let clean=String(message.prefix(500));guard !diagnostic.contains(clean) else{return};diagnostic=String((diagnostic.isEmpty ? clean : diagnostic+"\n"+clean).suffix(1800));startupTrace("web:"+clean)}
 func loaded(){startupTrace("loaded");ready=true;error="";attempts=0}
 func recover(_ reason:String){startupTrace("recover:"+reason);guard attempts<2 else{fail(reason+"。請按重新載入，資料不會刪除。");return};attempts+=1;start()}
 func foreground(){guard ready && error.isEmpty else{return};host?.checkReady(resuming:true)}
 func exportBackup(){let host=self.host ?? Host(url:URL(string:"http://127.0.0.1/")!,model:self);do{let data=try Data(contentsOf:host.path("state"));let wrapped=try JSONSerialization.jsonObject(with:data) as? [String:Any];guard let state=wrapped?["value"] else{throw host.failure("目前沒有可匯出的本機資料")};let url=FileManager.default.temporaryDirectory.appendingPathComponent("沐水-啟動救援備份.json");try JSONSerialization.data(withJSONObject:state,options:.prettyPrinted).write(to:url);let vc=UIActivityViewController(activityItems:[url],applicationActivities:nil);if let view=host.parent()?.view,let pop=vc.popoverPresentationController{pop.sourceView=view;pop.sourceRect=CGRect(x:view.bounds.midX,y:view.bounds.midY,width:1,height:1)};let presenter=host.parent() ?? UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap{$0.windows}.first(where:{$0.isKeyWindow})?.rootViewController;presenter?.present(vc,animated:true)}catch{self.error=error.localizedDescription}}
}
@main @MainActor struct Mushui170App:App {
 @StateObject var model=AppModel()
 @Environment(\.scenePhase) var phase
 init(){UNUserNotificationCenter.current().delegate=mushuiNotificationDelegate}
 var body:some Scene{WindowGroup{ZStack{
  Color(red:0.98,green:0.96,blue:0.99).ignoresSafeArea()
  if let url=model.url{LocalWeb(url:url,model:model).id(model.generation).ignoresSafeArea()}
  if !model.ready{VStack(spacing:20){Text("沐水").font(.largeTitle).foregroundStyle(Color.purple);if model.error.isEmpty{ProgressView();Text("正在開啟你的日常…")}else{Text("暫時無法顯示畫面").font(.headline);Text(model.error).font(.caption).multilineTextAlignment(.center);if !model.diagnostic.isEmpty{ScrollView{Text("啟動診斷：\n"+model.diagnostic).font(.system(size:11,design:.monospaced)).textSelection(.enabled).frame(maxWidth:.infinity,alignment:.leading).padding(10)}.frame(maxHeight:180).background(.white.opacity(0.7),in:RoundedRectangle(cornerRadius:12))};Button("重新載入"){model.start()}.buttonStyle(.borderedProminent);Button("匯出本機備份"){model.exportBackup()}}}.padding(30).frame(maxWidth:.infinity,maxHeight:.infinity).background(Color(red:0.98,green:0.96,blue:0.99))}
  NativeCallPanel(calls:model.calls)
 }.onChange(of:phase){value in if value == .active{model.foreground()}}}}
}
@MainActor struct LocalWeb:UIViewRepresentable {
 let url:URL;let model:AppModel
 func makeCoordinator()->Host{Host(url:url,model:model)}
 func makeUIView(context:Context)->WKWebView{startupTrace("make-web");let cfg=WKWebViewConfiguration();cfg.allowsInlineMediaPlayback=true;cfg.mediaTypesRequiringUserActionForPlayback=[];cfg.defaultWebpagePreferences.allowsContentJavaScript=true;cfg.userContentController.add(context.coordinator,name:"mushuiHost");cfg.userContentController.add(context.coordinator,name:"mushuiCall");cfg.userContentController.add(context.coordinator,name:"mushuiDiag");let diag=WKUserScript(source:"""
 window.__mushuiStartupErrors=[];
 function reportStartupIssue(value){window.__mushuiStartupErrors.push(value);try{webkit.messageHandlers.mushuiDiag.postMessage(value)}catch(_){}}
 window.addEventListener('error',function(e){var t=e.target||{};var s={kind:e.message?'js-error':'resource-error',message:String(e.message||t.tagName||'resource failed'),source:String(e.filename||t.src||t.href||''),line:e.lineno||0};reportStartupIssue(s)},true);
 window.addEventListener('unhandledrejection',function(e){reportStartupIssue({kind:'promise-rejection',message:String(e.reason&&e.reason.stack||e.reason||'unknown')})},true);
 window.addEventListener('securitypolicyviolation',function(e){reportStartupIssue({kind:'csp-violation',message:String(e.violatedDirective||''),source:String(e.blockedURI||'')})},true);
 """,injectionTime:.atDocumentStart,forMainFrameOnly:true);cfg.userContentController.addUserScript(diag);let v=WKWebView(frame:.zero,configuration:cfg);v.isOpaque=false;v.backgroundColor=UIColor{$0.userInterfaceStyle == .dark ? UIColor(red:0.086,green:0.075,blue:0.106,alpha:1) : UIColor(red:0.98,green:0.96,blue:0.99,alpha:1)};v.scrollView.backgroundColor=v.backgroundColor;context.coordinator.web=v;NativeCalls.web=v;model.host=context.coordinator;v.navigationDelegate=context.coordinator;v.uiDelegate=context.coordinator;v.scrollView.isScrollEnabled=false;v.scrollView.contentInsetAdjustmentBehavior = .never;v.load(URLRequest(url:url));context.coordinator.armWatchdog();return v}
 func updateUIView(_ view:WKWebView,context:Context){}
 static func dismantleUIView(_ view:WKWebView,coordinator:Host){coordinator.watchdog?.cancel();view.stopLoading();for name in ["mushuiHost","mushuiCall","mushuiDiag"]{view.configuration.userContentController.removeScriptMessageHandler(forName:name)}}
}
@MainActor final class Host:NSObject,WKScriptMessageHandler,WKNavigationDelegate,WKUIDelegate,UIImagePickerControllerDelegate,UINavigationControllerDelegate,CLLocationManagerDelegate{
 let origin:URL;let calls:NativeCalls;let generation:Int;weak var model:AppModel?;weak var web:WKWebView?;var watchdog:DispatchWorkItem?;var startupDeadline=Date.distantPast;var checkingReady=false;var cameraCall:String?;var locationCall:String?;var location:CLLocationManager?;let redirect=NoRedirect()
 init(url:URL,model:AppModel){origin=url;calls=model.calls;generation=model.generation;self.model=model}
 func armWatchdog(){watchdog?.cancel();startupDeadline=Date().addingTimeInterval(45);let work=DispatchWorkItem{[weak self] in self?.checkReady(final:true)};watchdog=work;DispatchQueue.main.asyncAfter(deadline:.now()+45,execute:work)}
 func checkReady(resuming:Bool=false,final:Bool=false){guard model?.generation==generation,let web,!checkingReady else{return};checkingReady=true;let script="(()=>{let app=document.querySelector('#app');let root=app&&app.querySelector('.page,.conversation,.desktop-shell,.login-gate');return JSON.stringify({ready:typeof state!=='undefined'&&!!state&&!!root,stateType:typeof state,root:!!root,rootClass:root&&root.className||'',readyState:document.readyState,secure:isSecureContext,crypto:typeof crypto!=='undefined'&&!!crypto.subtle,native:!!window.Native,iosHost:!!window.IOSHost,webEngine:!!window.WebEngine,bootError:window.__mushuiBootError||'',errors:(window.__mushuiStartupErrors||[]).slice(-5)});})()";web.evaluateJavaScript(script){[weak self] value,error in guard let self,self.model?.generation==self.generation else{return};self.checkingReady=false;let details=(value as? String).flatMap{Data($0.utf8)}.flatMap{try? JSONSerialization.jsonObject(with:$0)} as? [String:Any] ?? [:];if let errors=details["errors"] as? [[String:Any]]{for item in errors{let line=[item["kind"],item["message"],item["source"],item["line"]].compactMap{ $0 }.map{String(describing:$0)}.joined(separator:" · ");if !line.isEmpty{self.model?.recordDiagnostic(line)}}};if details["ready"] as? Bool==true{self.watchdog?.cancel();self.model?.loaded()}else if resuming{self.model?.recover("從背景恢復時介面已被系統回收")}else if final || Date()>=self.startupDeadline{let summary=["state=\(details["stateType"] ?? "unknown")","root=\(details["root"] ?? "unknown") · \(details["rootClass"] ?? "")","document=\(details["readyState"] ?? "unknown")","secure=\(details["secure"] ?? "unknown")","crypto=\(details["crypto"] ?? "unknown")","bridge=\(details["native"] ?? "unknown")","iOS=\(details["iosHost"] ?? "unknown")","engine=\(details["webEngine"] ?? "unknown")","boot=\(details["bootError"] ?? "")"].joined(separator:"\n");if !summary.isEmpty{self.model?.recordDiagnostic(summary)};self.model?.fail("介面未完成啟動。請截圖下方「啟動診斷」文字回報；可以重新載入或匯出本機備份。"+(error.map{" "+$0.localizedDescription} ?? ""))}else{DispatchQueue.main.asyncAfter(deadline:.now()+0.5){[weak self] in self?.checkReady()}}}}
 func webViewWebContentProcessDidTerminate(_ webView:WKWebView){guard model?.generation==generation else{return};watchdog?.cancel();model?.recover("介面程序已被系統回收")}
 func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error){guard model?.generation==generation else{return};if (error as NSError).code != NSURLErrorCancelled{watchdog?.cancel();model?.fail("載入失敗（\((error as NSError).code)）："+error.localizedDescription)}}
 func webView(_ webView:WKWebView,didFail navigation:WKNavigation!,withError error:Error){self.webView(webView,didFailProvisionalNavigation:navigation,withError:error)}

 func path(_ key:String)throws->URL{let folder=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true).appendingPathComponent(Bundle.main.bundleIdentifier=="app.mushui.ai.personal" ? "MushuiAI":"Mushui",isDirectory:true);try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true);let safe=key.data(using:.utf8)!.base64EncodedString().replacingOccurrences(of:"/",with:"_").replacingOccurrences(of:"+",with:"-");return folder.appendingPathComponent((key=="state" ? "state":String(safe.prefix(180)))+".json")}
 func reply(_ id:String,_ value:Any?=nil,_ error:String?=nil){var response:[String:Any]=["id":id,"ok":error==nil];if let error{response["error"]=error}else{response["data"]=value ?? NSNull()};if let data=try? JSONSerialization.data(withJSONObject:response),let json=String(data:data,encoding:.utf8){web?.evaluateJavaScript("window.iosHostResult&&iosHostResult(\(json));",completionHandler:nil)}}
 func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage){guard message.frameInfo.isMainFrame,message.frameInfo.securityOrigin.host=="127.0.0.1",message.frameInfo.securityOrigin.port==origin.port else{return};guard let d=message.body as? [String:Any] else{return};if message.name=="mushuiDiag"{let kind=String(describing:d["kind"] ?? "js-error"),text=String(describing:d["message"] ?? "unknown"),source=String(describing:d["source"] ?? ""),line=String(describing:d["line"] ?? "");model?.recordDiagnostic([kind,text,source,line].filter{!$0.isEmpty}.joined(separator:" · "));return};if message.name=="mushuiCall"{if let server=d["server"] as? String,let u=URL(string:server),u.scheme=="https"{calls.receive(d)};return};guard let id=d["id"] as? String,let op=d["op"] as? String else{return};let args=d["data"] as? [String:Any] ?? [:];Task{do{switch op{
 #if targetEnvironment(simulator)
 case "startupQA":finishQA(args);reply(id,true)
 #endif
 case "get":let p=try path(args["key"] as? String ?? "");let data=try? Data(contentsOf:p);let value=data.flatMap{try? JSONSerialization.jsonObject(with:$0)} as? [String:Any];reply(id,value?["value"])
 case "put":let p=try path(args["key"] as? String ?? ""),data=try JSONSerialization.data(withJSONObject:["value":args["value"] ?? NSNull()]);if data.count>52*1024*1024{throw failure("本機資料過大")};try data.write(to:p,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication]);reply(id,true)
 case "key":reply(id,try secret(args))
 case "http":reply(id,try await http(args))
 case "microphone":let yes=await withCheckedContinuation{(c:CheckedContinuation<Bool,Never>)in AVAudioSession.sharedInstance().requestRecordPermission{c.resume(returning:$0)}};reply(id,["granted":yes])
 case "cameraPermission":let yes=await AVCaptureDevice.requestAccess(for:.video);reply(id,["granted":yes])
 case "takePhoto":guard UIImagePickerController.isSourceTypeAvailable(.camera) else{throw failure("此裝置沒有可用的系統相機")};let picker=UIImagePickerController();picker.sourceType = .camera;picker.delegate=self;cameraCall=id;parent()?.present(picker,animated:true)
 case "savePhoto":guard let value=args["image"] as? String,let comma=value.firstIndex(of:","),let imageData=Data(base64Encoded:String(value[value.index(after:comma)...])),let image=UIImage(data:imageData) else{throw failure("照片格式無效")};let current=PHPhotoLibrary.authorizationStatus(for:.addOnly);let status:PHAuthorizationStatus=current == .notDetermined ? await withCheckedContinuation{continuation in PHPhotoLibrary.requestAuthorization(for:.addOnly){continuation.resume(returning:$0)}}:current;guard status == .authorized || status == .limited else{throw failure("請允許沐水新增照片到相簿")};try await withCheckedThrowingContinuation{(continuation:CheckedContinuation<Void,Error>) in PHPhotoLibrary.shared().performChanges({PHAssetChangeRequest.creationRequestForAsset(from:image)}){saved,error in if let error{continuation.resume(throwing:error)}else if saved{continuation.resume()}else{continuation.resume(throwing:self.failure("保存照片失敗"))}}};reply(id,true)
 case "save":let name=(args["name"] as? String ?? "沐水.json").replacingOccurrences(of:"/",with:"_");let url=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString+"-"+name);let data=(args["base64"] as? String).flatMap{Data(base64Encoded:$0)} ?? Data((args["text"] as? String ?? "").utf8);try data.write(to:url);let vc=UIActivityViewController(activityItems:[url],applicationActivities:nil);if let pop=vc.popoverPresentationController,let v=parent()?.view{pop.sourceView=v;pop.sourceRect=CGRect(x:v.bounds.midX,y:v.bounds.midY,width:1,height:1)};vc.completionWithItemsHandler={_,done,_,_ in try? FileManager.default.removeItem(at:url);Task{@MainActor in self.reply(id,done)}};parent()?.present(vc,animated:true)
 case "voiceSession":if args["active"] as? Bool==true{try AVAudioSession.sharedInstance().setCategory(.playAndRecord,mode:.voiceChat,options:[.defaultToSpeaker,.allowBluetooth]);try AVAudioSession.sharedInstance().setActive(true)}else if !calls.visible{try? AVAudioSession.sharedInstance().setActive(false,options:.notifyOthersOnDeactivation)};reply(id,[:])
 case "notifications":let yes=try await UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.badge,.sound]);reply(id,["granted":yes])
 case "notify":let center=UNUserNotificationCenter.current(),tag=args["tag"] as? String ?? UUID().uuidString;if args["clear"] as? Bool == true{center.removeDeliveredNotifications(withIdentifiers:[tag]);center.removePendingNotificationRequests(withIdentifiers:[tag]);reply(id,true);break};let content=UNMutableNotificationContent();content.title=args["title"] as? String ?? "沐水";content.body=args["body"] as? String ?? "";content.sound = .default;let request=UNNotificationRequest(identifier:tag,content:content,trigger:nil);try await center.add(request);reply(id,true)
 case "locationPermission":let m=CLLocationManager();location=m;locationCall=id;m.delegate=self;m.desiredAccuracy=kCLLocationAccuracyKilometer;m.requestWhenInUseAuthorization();locationManagerDidChangeAuthorization(m)
 case "clearCache":await WKWebsiteDataStore.default().removeData(ofTypes:[WKWebsiteDataTypeDiskCache,WKWebsiteDataTypeMemoryCache],modifiedSince:Date.distantPast);URLCache.shared.removeAllCachedResponses();reply(id,true)
 case "life":reply(id,[:])
 case "setAppIcon":let theme=args["theme"] as? String ?? "lilac";guard ["lilac","rose","mint","peach","blue","lemon"].contains(theme) else{throw failure("圖標主題無效")};guard UIApplication.shared.supportsAlternateIcons else{throw failure("此裝置不支援更換圖標")};try await UIApplication.shared.setAlternateIconName(theme=="lilac" ? nil:theme);reply(id,["changed":true])
 default:throw failure("不支援操作："+op)
 }}catch{reply(id,nil,error.localizedDescription)}}}
 func failure(_ text:String)->NSError{NSError(domain:"Mushui",code:1,userInfo:[NSLocalizedDescriptionKey:text])}
 func secret(_ args:[String:Any])throws->String{let slot=args["slot"] as? String ?? "";guard ["chat","image","voice","tts","human","accountSync","accountKeys"].contains(slot)else{throw failure("金鑰類型無效")};let q:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:Bundle.main.bundleIdentifier ?? "app.mushui.personal",kSecAttrAccount as String:slot];if let value=args["value"] as? String{if value.isEmpty{SecItemDelete(q as CFDictionary);return ""};var add=q;add[kSecValueData as String]=Data(value.utf8);add[kSecAttrAccessible as String]=kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;SecItemDelete(q as CFDictionary);guard SecItemAdd(add as CFDictionary,nil)==errSecSuccess else{throw failure("Keychain 儲存失敗")};return value};var read=q;read[kSecReturnData as String]=true;read[kSecMatchLimit as String]=kSecMatchLimitOne;var result:CFTypeRef?;let status=SecItemCopyMatching(read as CFDictionary,&result);if status==errSecItemNotFound{return ""};guard status==errSecSuccess else{throw failure("Keychain 無法讀取：\(status)")};return (result as? Data).flatMap{String(data:$0,encoding:.utf8)} ?? ""}
 func http(_ args:[String:Any])async throws->[String:Any]{guard let s=args["url"] as? String,let url=URL(string:s),url.scheme=="https",url.host != nil,url.user==nil,url.password==nil,url.fragment==nil else{throw failure("服務需要 HTTPS")};var req=URLRequest(url:url);req.httpMethod=args["method"] as? String ?? "POST";req.timeoutInterval=180;guard ["GET","POST"].contains(req.httpMethod!)else{throw failure("請求方式無效")};for(k,v)in args["headers"] as? [String:String] ?? [:]{if !k.contains("\n") && !v.contains("\n") && !v.contains("\r"){req.setValue(v,forHTTPHeaderField:k)}};if args["transcription"] as? Bool==true{guard let audio=args["audio"] as? [String:Any],let raw=audio["data"] as? String,let encoded=raw.split(separator:",").last,let bytes=Data(base64Encoded:String(encoded)),bytes.count<5000000 else{throw failure("語音格式無效")};let b="Mushui"+UUID().uuidString;var data=Data("--\(b)\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n\(args["model"] as? String ?? "whisper-1")\r\n--\(b)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"voice.wav\"\r\nContent-Type: audio/wav\r\n\r\n".utf8);data.append(bytes);data.append(Data("\r\n--\(b)--\r\n".utf8));req.httpBody=data;req.setValue("multipart/form-data; boundary=\(b)",forHTTPHeaderField:"Content-Type")}else if let body=args["body"],!(body is NSNull){req.httpBody=try JSONSerialization.data(withJSONObject:body);req.setValue("application/json",forHTTPHeaderField:"Content-Type")};let session=URLSession(configuration:.default,delegate:redirect,delegateQueue:nil);defer{session.finishTasksAndInvalidate()};let(data,response)=try await session.data(for:req);guard data.count<80*1024*1024,let r=response as? HTTPURLResponse else{throw failure("服務回覆無效")};if args["speech"] as? Bool==true && (200..<300).contains(r.statusCode){return ["status":r.statusCode,"ok":true,"value":["audio":["data":"data:audio/wav;base64,"+data.base64EncodedString()]]]};let value=try JSONSerialization.jsonObject(with:data);return ["status":r.statusCode,"ok":(200..<300).contains(r.statusCode),"value":value]}
 func parent()->UIViewController?{var vc=web?.window?.rootViewController;while let shown=vc?.presentedViewController{vc=shown};return vc}
 func imagePickerControllerDidCancel(_ picker:UIImagePickerController){picker.dismiss(animated:true);if let id=cameraCall{reply(id,[:])};cameraCall=nil}
 func imagePickerController(_ picker:UIImagePickerController,didFinishPickingMediaWithInfo info:[UIImagePickerController.InfoKey:Any]){picker.dismiss(animated:true);if let id=cameraCall,let image=info[.originalImage] as? UIImage,let data=image.jpegData(compressionQuality:0.85){reply(id,["image":"data:image/jpeg;base64,"+data.base64EncodedString()])};cameraCall=nil}
 func locationManagerDidChangeAuthorization(_ m:CLLocationManager){if [.authorizedWhenInUse,.authorizedAlways].contains(m.authorizationStatus){m.requestLocation()}else if m.authorizationStatus != .notDetermined,let id=locationCall{reply(id,["granted":false]);locationCall=nil}}
 func locationManager(_ manager:CLLocationManager,didUpdateLocations locations:[CLLocation]){if let l=locations.last,let id=locationCall{reply(id,["granted":true,"geo":["latitude":(l.coordinate.latitude*100).rounded()/100,"longitude":(l.coordinate.longitude*100).rounded()/100,"updatedAt":Date().timeIntervalSince1970*1000]]);locationCall=nil}}
 func locationManager(_ manager:CLLocationManager,didFailWithError error:Error){if let id=locationCall{reply(id,["granted":false]);locationCall=nil}}
 func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){if let u=action.request.url,u.host==origin.host,u.port==origin.port{decisionHandler(.allow)}else{if action.navigationType == .linkActivated,let u=action.request.url,["https","http"].contains(u.scheme ?? ""){UIApplication.shared.open(u)};decisionHandler(.cancel)}}
 func webView(_ webView:WKWebView,requestMediaCapturePermissionFor origin:WKSecurityOrigin,initiatedByFrame frame:WKFrameInfo,type:WKMediaCaptureType,decisionHandler:@escaping(WKPermissionDecision)->Void){decisionHandler(origin.host==self.origin.host && origin.port==self.origin.port ? .prompt:.deny)}
 func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){startupTrace("navigation-finished");
 DispatchQueue.main.asyncAfter(deadline:.now()+1){[weak self] in self?.checkReady()}
 #if targetEnvironment(simulator)
 DispatchQueue.main.asyncAfter(deadline:.now()+8){[weak self] in guard let self,self.model?.generation==self.generation else{return};
 webView.evaluateJavaScript("(async()=>{try{const assetSizes=Object.fromEntries(await Promise.all(['app.js','web-store.js','fonts/zpix.ttf'].map(async name=>{const r=await fetch(name,{cache:'no-store'});if(!r.ok)throw Error('Asset '+name+': '+r.status);return [name,(await r.arrayBuffer()).byteLength];})));const prior=await WebEngine.get('qa-startup-recovery');await WebEngine.put('qa-startup-recovery','kept');await Desktop.invoke('startupQA',{ready:typeof state!=='undefined'&&!!state,secure:isSecureContext,crypto:!!crypto.subtle,version:typeof aboutPage==='function'&&aboutPage().includes('2.1.1'),preserved:prior==='kept',assetSizes,body:document.body.innerText.slice(0,180)});}catch(e){await Desktop.invoke('startupQA',{error:e.message});}})();true;",completionHandler:nil)

 }
 #endif
 }
 #if targetEnvironment(simulator)
 func finishQA(_ value:[String:Any]){
  guard model?.generation==generation else{return};var report=value
  let sizes=value["assetSizes"] as? [String:Int] ?? [:];let root=Bundle.main.url(forResource:"www",withExtension:nil)!;report["assetsComplete"] = ["app.js","web-store.js","fonts/zpix.ttf"].allSatisfy{path in guard let bytes=try? Data(contentsOf:root.appendingPathComponent(path)) else{return false};return sizes[path]==bytes.count}
  let round=model?.qaRound ?? 0;let recovery=ProcessInfo.processInfo.arguments.contains("--recovery-qa");report["nativeReady"]=model?.ready ?? false;report["recoveryComplete"] = !recovery || round>=2;report["recoveryRounds"]=round;report["osVersion"]=ProcessInfo.processInfo.operatingSystemVersionString
  let file=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0].appendingPathComponent("qa-status.json");if let data=try? JSONSerialization.data(withJSONObject:report){try? data.write(to:file)}
  if recovery && round<2 && report["ready"] as? Bool==true{model?.qaRound=round+1;if round==0,let web{webViewWebContentProcessDidTerminate(web)}else{model?.fail("測試載入失敗提示與重試");DispatchQueue.main.asyncAfter(deadline:.now()+1){[weak self] in self?.model?.start()}}}
 }
 #endif

}
@MainActor struct NativeVideo:UIViewRepresentable{
 let track:RTCVideoTrack;var fill:Bool=false;var mirror:Bool=false
 class Coordinator{var track:RTCVideoTrack?}
 func makeCoordinator()->Coordinator{Coordinator()}
 func makeUIView(context:Context)->RTCMTLVideoView{let view=RTCMTLVideoView(frame:.zero);view.videoContentMode = fill ? .scaleAspectFill : .scaleAspectFit;view.clipsToBounds=true;view.transform = mirror ? CGAffineTransform(scaleX:-1,y:1) : .identity;context.coordinator.track=track;track.add(view);return view}
 func updateUIView(_ view:RTCMTLVideoView,context:Context){view.videoContentMode = fill ? .scaleAspectFill : .scaleAspectFit;view.transform = mirror ? CGAffineTransform(scaleX:-1,y:1) : .identity;if context.coordinator.track !== track{context.coordinator.track?.remove(view);context.coordinator.track=track;track.add(view)}}
 static func dismantleUIView(_ view:RTCMTLVideoView,coordinator:Coordinator){coordinator.track?.remove(view)}
}
// 2.1.1 call screen: blurred backdrop, rounded avatar, name, status chip, round controls (mic / hang up / speaker),
// full-screen video when either side shares a camera, self view top-left, lens switch top-right, minimize top-left.
@MainActor struct NativeCallPanel:View {
 @ObservedObject var calls:NativeCalls
 var remote:RTCVideoTrack? { if calls.screenShowing,let t=calls.remoteScreen{return t};if calls.cameraShowing,let t=calls.remoteCamera{return t};return nil }
 var name:String { calls.peerName.isEmpty ? calls.peer : calls.peerName }
 var videoMode:Bool { remote != nil || calls.localPreview != nil }
 func timeText(_ now:Date)->String{
  guard let start=calls.connectedAt else{return calls.incoming ? "邀請你語音通話" : (calls.message.isEmpty || calls.message=="通話中" ? "等待對方接受邀請" : calls.message)}
  let t=max(0,Int(now.timeIntervalSince(start)));let h=t/3600,m=(t%3600)/60,sec=t%60
  return h>0 ? String(format:"%d:%02d:%02d",h,m,sec) : String(format:"%02d:%02d",m,sec)
 }
 func callButton(_ icon:String,_ label:String,_ fill:Color,_ tint:Color = .white,size:CGFloat=66,_ action:@escaping()->Void)->some View{
  Button(action:action){VStack(spacing:10){Image(systemName:icon).font(.system(size:size*0.36,weight:.medium)).foregroundColor(tint).frame(width:size,height:size).background(Circle().fill(fill));Text(label).font(.system(size:13)).foregroundColor(.white.opacity(0.92)).lineLimit(1)}.frame(minWidth:88)}.buttonStyle(.plain)
 }
 var glass:Color { Color.white.opacity(0.18) }
 var backdrop:some View{
  ZStack{
   LinearGradient(colors:[Color(red:0.42,green:0.35,blue:0.49),Color(red:0.16,green:0.14,blue:0.19),Color(red:0.09,green:0.08,blue:0.10)],startPoint:.topLeading,endPoint:.bottom)
   if let image=calls.peerImage{Image(uiImage:image).resizable().scaledToFill().blur(radius:40).scaleEffect(1.2).opacity(0.85)}
   LinearGradient(colors:[.black.opacity(0.30),.black.opacity(0.15),.black.opacity(0.45)],startPoint:.top,endPoint:.bottom)
  }.ignoresSafeArea()
 }
 var avatarView:some View{
  Group{if let image=calls.peerImage{Image(uiImage:image).resizable().scaledToFill()}else{Text(String(name.prefix(1))).font(.system(size:44,weight:.bold)).foregroundColor(.white).frame(maxWidth:.infinity,maxHeight:.infinity).background(Color.white.opacity(0.16))}}
  .frame(width:112,height:112).clipShape(RoundedRectangle(cornerRadius:26,style:.continuous)).shadow(color:.black.opacity(0.3),radius:16,y:8)
 }
 @ViewBuilder var videoLayer:some View{
  if let remote,let local=calls.localPreview{
   let big = calls.swapped ? local : remote, small = calls.swapped ? remote : local
   NativeVideo(track:big,fill:!(calls.screenShowing && !calls.swapped),mirror:calls.swapped && calls.usingFront).ignoresSafeArea()
   VStack{HStack{NativeVideo(track:small,fill:true,mirror:!calls.swapped && calls.usingFront).frame(width:118,height:158).clipShape(RoundedRectangle(cornerRadius:16,style:.continuous)).overlay(RoundedRectangle(cornerRadius:16,style:.continuous).stroke(Color.white.opacity(0.35),lineWidth:2)).shadow(color:.black.opacity(0.4),radius:10,y:4).onTapGesture{calls.swapped.toggle()}.padding(.leading,14).padding(.top,62);Spacer()};Spacer()}
  } else if let remote {
   NativeVideo(track:remote,fill:!calls.screenShowing).ignoresSafeArea()
  } else if let local=calls.localPreview {
   NativeVideo(track:local,fill:true,mirror:calls.usingFront).ignoresSafeArea()
  }
 }
 var body:some View {
  if calls.visible && !calls.minimized {
   ZStack {
    if videoMode { Color.black.ignoresSafeArea(); videoLayer; LinearGradient(colors:[.black.opacity(0.35),.clear,.clear,.black.opacity(0.5)],startPoint:.top,endPoint:.bottom).ignoresSafeArea().allowsHitTesting(false) } else { backdrop }
    VStack(spacing:0) {
     HStack {
      Button{calls.minimize()}label:{Image(systemName:"pip.enter").font(.system(size:18,weight:.medium)).foregroundColor(.white).frame(width:42,height:42).background(Circle().fill(glass))}.buttonStyle(.plain)
      Spacer()
      if videoMode { TimelineView(.periodic(from:.now,by:1)){ctx in VStack(spacing:2){Text(name).font(.system(size:16,weight:.semibold));Text(timeText(ctx.date)).font(.system(size:13).monospacedDigit()).opacity(0.85)}.foregroundColor(.white).shadow(radius:3)} }
      Spacer()
      Button{calls.switchCamera()}label:{Image(systemName:"arrow.triangle.2.circlepath.camera").font(.system(size:18,weight:.medium)).foregroundColor(.white).frame(width:42,height:42).background(Circle().fill(glass))}.buttonStyle(.plain).opacity(calls.cameraEnabled ? 1 : 0).disabled(!calls.cameraEnabled)
     }.padding(.horizontal,16).padding(.top,8)
     if !videoMode {
      Spacer().frame(height:90)
      avatarView
      Text(name).font(.system(size:30,weight:.bold)).foregroundColor(.white).padding(.top,18)
      TimelineView(.periodic(from:.now,by:1)){ctx in Text(timeText(ctx.date)).font(.system(size:15).monospacedDigit()).foregroundColor(.white).padding(.horizontal,16).padding(.vertical,6).background(Capsule().fill(Color.white.opacity(0.16)))}.padding(.top,12)
      if calls.connectedAt == nil { TimelineView(.periodic(from:.now,by:0.4)){ctx in let step=Int(ctx.date.timeIntervalSince1970*2.5)%3; HStack(spacing:7){ForEach(0..<3,id:\.self){i in Circle().fill(Color.white.opacity(i==step ? 1 : 0.35)).frame(width:7,height:7)}}}.padding(.top,16) }
     }
     Spacer()
     if calls.incoming {
      HStack{ callButton("phone.down.fill","拒絕",Color(red:1,green:0.30,blue:0.31)){calls.endFromUI()}; Spacer(); callButton("phone.fill","接聽",Color(red:0.20,green:0.78,blue:0.35)){calls.acceptFromUI()} }.padding(.horizontal,48)
     } else {
      callButton(calls.cameraEnabled ? "video.fill":"video.slash.fill",calls.cameraEnabled ? "視訊已開啟":"開啟視訊",calls.cameraEnabled ? Color.white : glass,calls.cameraEnabled ? Color(red:0.17,green:0.15,blue:0.19) : .white,size:50){calls.toggleCamera()}.padding(.bottom,20)
      HStack(alignment:.top){
       callButton(calls.muted ? "mic.slash.fill":"mic.fill",calls.muted ? "麥克風已關閉":"麥克風已開啟",calls.muted ? Color.white : glass,calls.muted ? Color(red:0.17,green:0.15,blue:0.19) : .white){calls.toggleMute()}
       Spacer()
       callButton("phone.down.fill",calls.connectedAt == nil ? "取消":"掛斷",Color(red:1,green:0.30,blue:0.31),size:74){calls.endFromUI()}
       Spacer()
       callButton(calls.speaker ? "speaker.wave.2.fill":"iphone",calls.speaker ? "揚聲器":"一般",calls.speaker ? Color.white : glass,calls.speaker ? Color(red:0.17,green:0.15,blue:0.19) : .white){calls.toggleSpeaker()}
      }.padding(.horizontal,24)
     }
     Spacer().frame(height:36)
    }
   }
   .transition(.opacity)
  }
 }
}
