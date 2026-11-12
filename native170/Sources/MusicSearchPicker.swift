import UIKit
import WebKit
@MainActor final class MusicSearchPicker:UIViewController,WKNavigationDelegate {
 private let initial:String;private var completion:(([String:Any])->Void)?;private let browser=WKWebView(frame:.zero);private var observation:NSKeyValueObservation?
 init(url:String,completion:@escaping([String:Any])->Void){initial=url;self.completion=completion;super.init(nibName:nil,bundle:nil)}
 required init?(coder:NSCoder){fatalError("init(coder:) unavailable")}
 static func allowed(_ raw:String)->Bool{guard let u=URL(string:raw),u.scheme=="https",let host=u.host else{return false};return ["youtube.com","youtu.be","bilibili.com","spotify.com","apple.com","kkbox.com"].contains{host==$0 || host.hasSuffix("."+$0)}}
 static func song(_ raw:String)->Bool{guard allowed(raw),let u=URL(string:raw) else{return false};return u.host=="youtu.be" || u.path.range(of:"/(watch|video|track|album|song|playlist)(/|$)",options:.regularExpression) != nil}
 override func viewDidLoad(){super.viewDidLoad();view.backgroundColor = .systemBackground
  let close=UIButton(type:.system);close.setTitle("關閉歌曲搜尋",for:.normal);close.addTarget(self,action:#selector(cancel),for:.touchUpInside)
  close.translatesAutoresizingMaskIntoConstraints=false;browser.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(close);view.addSubview(browser)
  NSLayoutConstraint.activate([close.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),close.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:16),close.heightAnchor.constraint(equalToConstant:44),browser.topAnchor.constraint(equalTo:close.bottomAnchor),browser.leadingAnchor.constraint(equalTo:view.leadingAnchor),browser.trailingAnchor.constraint(equalTo:view.trailingAnchor),browser.bottomAnchor.constraint(equalTo:view.bottomAnchor)])
  browser.navigationDelegate=self;observation=browser.observe(\.url,options:[.new]){[weak self] web,_ in guard let self,let raw=web.url?.absoluteString else{return};Task{@MainActor in self.choose(raw)}}
  if let url=URL(string:initial){browser.load(URLRequest(url:url))}
 }
 private func finish(_ result:[String:Any]){guard let completion else{return};self.completion=nil;observation=nil;browser.stopLoading();dismiss(animated:true){completion(result)}}
 private func choose(_ raw:String){if Self.song(raw){finish(["url":raw,"title":browser.title ?? ""])}}
 @objc private func cancel(){finish(["cancelled":true])}
 func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){guard let raw=navigationAction.request.url?.absoluteString else{decisionHandler(.cancel);return};if navigationAction.targetFrame?.isMainFrame != false {if Self.song(raw){decisionHandler(.cancel);choose(raw);return};if !Self.allowed(raw){decisionHandler(.cancel);return}};decisionHandler(.allow)}
}
