import Foundation
import WebKit
import Capacitor
import UIKit
import Security
import CoreLocation
import UserNotifications

@objc(AppViewController) class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MushuiLocalPlugin())
        if let folder = try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true), let data = try? Data(contentsOf: folder.appendingPathComponent("MushuiAI/startup-font.json")), let json = String(data:data,encoding:.utf8) {
            webView?.configuration.userContentController.addUserScript(WKUserScript(source:"window.mushuiStartupFont=\(json);",injectionTime:.atDocumentStart,forMainFrameOnly:true))
        }
        webView?.scrollView.isScrollEnabled = false
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }
}
final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
@objc(MushuiLocalPlugin) class MushuiLocalPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    let identifier = "MushuiLocalPlugin"
    let jsName = "MushuiLocal"
    let pluginMethods: [CAPPluginMethod] = ["get","put","secret","http","share","notifications","location"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private let io = DispatchQueue(label: "mushui.local.storage")
    private let redirect = NoRedirect()
    private var manager: CLLocationManager?
    private var locationCall: CAPPluginCall?
    private func path(_ key: String) throws -> URL {
        guard key.range(of: "^[a-z0-9-]{1,60}$", options: .regularExpression) != nil else { throw NSError(domain: "Mushui", code: 1, userInfo: [NSLocalizedDescriptionKey:"Invalid local key"]) }
        let folder = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("MushuiAI", isDirectory:true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent(key+".json")
    }
    @objc func get(_ call: CAPPluginCall) { io.async { do { let p = try self.path(call.getString("key") ?? ""); if !FileManager.default.fileExists(atPath:p.path) { call.resolve(["value":NSNull()]);return }; let v = try JSONSerialization.jsonObject(with:Data(contentsOf:p)) as? [String:Any];call.resolve(v ?? ["value":NSNull()]) } catch { call.reject(error.localizedDescription) } } }
    @objc func put(_ call: CAPPluginCall) { io.async { do { let p = try self.path(call.getString("key") ?? ""),data = try JSONSerialization.data(withJSONObject:["value":call.options["value"] ?? NSNull()]);guard data.count <= 52*1024*1024 else { call.reject("本機資料過大");return };try data.write(to:p,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication]);if call.getString("key")=="state",let state=call.options["value"] as? [String:Any],let settings=state["settings"] as? [String:Any] { let font:[String:Any]=["font":settings["font"] ?? "system","customFont":settings["customFont"] ?? ""];try JSONSerialization.data(withJSONObject:font).write(to:p.deletingLastPathComponent().appendingPathComponent("startup-font.json"),options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication]) };call.resolve() } catch { call.reject(error.localizedDescription) } } }
    @objc func secret(_ call: CAPPluginCall) {
        let slot=call.getString("slot") ?? "";guard ["chat","image","voice"].contains(slot) else { call.reject("Unknown key slot");return }
        let q:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"app.mushui.ai.extra",kSecAttrAccount as String:slot]
        if let v=call.getString("value") { if v.isEmpty { SecItemDelete(q as CFDictionary);call.resolve(["value":""]);return };let d=Data(v.utf8);var result=SecItemUpdate(q as CFDictionary,[kSecValueData as String:d] as CFDictionary);if result==errSecItemNotFound { var add=q;add[kSecValueData as String]=d;add[kSecAttrAccessible as String]=kSecAttrAccessibleWhenUnlockedThisDeviceOnly;result=SecItemAdd(add as CFDictionary,nil) };guard result==errSecSuccess else { call.reject("Keychain 儲存失敗");return };call.resolve(["value":v]);return }
        var read=q;read[kSecReturnData as String]=true;read[kSecMatchLimit as String]=kSecMatchLimitOne;var result:CFTypeRef?;let status=SecItemCopyMatching(read as CFDictionary,&result);guard status==errSecSuccess||status==errSecItemNotFound else { call.reject("Keychain 暫時無法讀取，請解鎖手機");return };call.resolve(["value":(result as? Data).flatMap { String(data:$0,encoding:.utf8) } ?? ""])
    }
    @objc func http(_ call: CAPPluginCall) {
        guard let raw=call.getString("url"),let url=URL(string:raw),url.scheme=="https",url.host != nil,url.user==nil,url.password==nil else { call.reject("API 網址須為 HTTPS");return }
        var request=URLRequest(url:url);request.httpMethod=call.getString("method") ?? "POST";request.timeoutInterval=180
        guard ["GET","POST"].contains(request.httpMethod ?? "") else { call.reject("Unsupported HTTP method");return }
        for (k,v) in call.getObject("headers") ?? [:] { guard let value=v as? String,["authorization","x-api-key","x-goog-api-key","anthropic-version"].contains(k.lowercased()) else { continue };request.setValue(value,forHTTPHeaderField:k) }
        do {
            if call.getBool("transcription") == true {
                guard let audio=call.getObject("audio"),let value=audio["data"] as? String,value.hasPrefix("data:audio/wav;base64,"),let bytes=Data(base64Encoded:String(value.dropFirst(22))),bytes.count>=44,bytes.count<=4000044,String(data:bytes.prefix(4),encoding:.ascii)=="RIFF",String(data:bytes.subdata(in:8..<12),encoding:.ascii)=="WAVE" else { call.reject("語音格式無效");return }
                let model=call.getString("model") ?? "whisper-1";guard model.range(of:"^[A-Za-z0-9._-]{1,120}$",options:.regularExpression) != nil else { call.reject("語音模型格式無效");return }
                let b="Mushui-"+UUID().uuidString;var data=Data();func append(_ s:String){data.append(Data(s.utf8))};append("--\(b)\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n\(model)\r\n--\(b)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"voice.wav\"\r\nContent-Type: audio/wav\r\n\r\n");data.append(bytes);append("\r\n--\(b)--\r\n");request.httpBody=data;request.setValue("multipart/form-data; boundary=\(b)",forHTTPHeaderField:"Content-Type")
            } else if request.httpMethod != "GET",let body=call.getObject("body") { request.httpBody=try JSONSerialization.data(withJSONObject:body);request.setValue("application/json",forHTTPHeaderField:"Content-Type") }
        } catch { call.reject("請求內容無效");return }
        let config=URLSessionConfiguration.ephemeral;config.httpShouldSetCookies=false;config.urlCache=nil;let session=URLSession(configuration:config,delegate:redirect,delegateQueue:nil)
        session.dataTask(with:request) { data,response,error in defer { session.finishTasksAndInvalidate() };if let error=error { call.reject(error.localizedDescription);return };guard let response=response as? HTTPURLResponse,let data=data,data.count<=32*1024*1024 else { call.reject("API 回應過大或無效");return };let json=(try? JSONSerialization.jsonObject(with:data)) ?? ["error":String(data:data.prefix(1000),encoding:.utf8) ?? "無法解讀回應"];call.resolve(["status":response.statusCode,"data":json]) }.resume()
    }
    @objc func share(_ call: CAPPluginCall) { DispatchQueue.main.async { do { let text=call.getString("text") ?? "",name=(call.getString("name") ?? "沐水AI備份.json").replacingOccurrences(of:"/",with:"_");let url=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString+"-"+name);try Data(text.utf8).write(to:url,options:.atomic);let vc=UIActivityViewController(activityItems:[url],applicationActivities:nil);guard let parent=self.bridge?.viewController else { call.reject("無法開啟分享");return };if let pop=vc.popoverPresentationController { pop.sourceView=parent.view;pop.sourceRect=CGRect(x:parent.view.bounds.midX,y:parent.view.bounds.midY,width:1,height:1) };vc.completionWithItemsHandler={ _,_,_,_ in try? FileManager.default.removeItem(at:url);call.resolve() };parent.present(vc,animated:true) } catch { call.reject(error.localizedDescription) } } }
    @objc func notifications(_ call: CAPPluginCall) { UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.badge,.sound]) { granted,_ in call.resolve(["granted":granted]) } }
    @objc func location(_ call: CAPPluginCall) { DispatchQueue.main.async { self.locationCall=call;let m=self.manager ?? CLLocationManager();self.manager=m;m.delegate=self;m.desiredAccuracy=kCLLocationAccuracyThreeKilometers;m.distanceFilter=1000;if m.authorizationStatus == .notDetermined { m.requestWhenInUseAuthorization() } else { self.locationManagerDidChangeAuthorization(m) } } }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { if [.authorizedAlways,.authorizedWhenInUse].contains(manager.authorizationStatus) { manager.startUpdatingLocation() } else if manager.authorizationStatus != .notDetermined { locationCall?.resolve(["granted":false]);locationCall=nil } }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations:[CLLocation]) { guard let l=locations.last else { return };let geo:[String:Any]=["latitude":(l.coordinate.latitude*100).rounded()/100,"longitude":(l.coordinate.longitude*100).rounded()/100,"updatedAt":Date().timeIntervalSince1970*1000];locationCall?.resolve(["granted":true,"geo":geo]);locationCall=nil;if let data=try? JSONSerialization.data(withJSONObject:geo),let json=String(data:data,encoding:.utf8) { bridge?.webView?.evaluateJavaScript("window.WebEngine&&(WebEngine.geo=\(json));",completionHandler:nil) } }
    func locationManager(_ manager: CLLocationManager, didFailWithError error:Error) { locationCall?.resolve(["granted":false]);locationCall=nil }
}
