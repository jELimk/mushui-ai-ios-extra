import Foundation
import UIKit
import UserNotifications

final class MushuiPushDelegate:NSObject,UIApplicationDelegate {
 func application(_ application:UIApplication,didRegisterForRemoteNotificationsWithDeviceToken deviceToken:Data) {
  let hex=deviceToken.map{String(format:"%02x",$0)}.joined()
  Task { @MainActor in MushuiPush.shared.updateToken(hex) }
 }
 func application(_ application:UIApplication,didFailToRegisterForRemoteNotificationsWithError error:Error) {
  // App remains usable without APNs; release diagnostics must report this separately.
  NSLog("Mizuki APNs unavailable: %@",String(describing:type(of:error)))
 }
}

@MainActor final class MushuiPush {
 static let shared=MushuiPush()
 private var base="", auth="", token=""
 private let device:String
 private init(){
  let defaults=UserDefaults.standard
  if let id=defaults.string(forKey:"mizuki-push-device") {device=id}
  else {let id=UUID().uuidString.replacingOccurrences(of:"-",with:"");defaults.set(id,forKey:"mizuki-push-device");device=id}
  token=defaults.string(forKey:"mizuki-apns-token") ?? ""
 }
 func configure(server:String,auth:String){
  base=server.trimmingCharacters(in:CharacterSet(charactersIn:"/"));self.auth=auth
  if !token.isEmpty {Task{await upload()}}
 }
 func updateToken(_ value:String){
  token=value;UserDefaults.standard.set(value,forKey:"mizuki-apns-token")
  if !auth.isEmpty {Task{await upload()}}
 }
 private func upload() async {
  guard !token.isEmpty,!base.isEmpty,!auth.isEmpty,let url=URL(string:base+"/v1/apns"),url.scheme=="https" else{return}
  var request=URLRequest(url:url);request.httpMethod="POST"
  request.setValue("Bearer "+auth,forHTTPHeaderField:"Authorization")
  request.setValue("application/json",forHTTPHeaderField:"Content-Type")
  request.httpBody=try? JSONSerialization.data(withJSONObject:["token":token,"device":device])
  do{let (_,response)=try await URLSession.shared.data(for:request)
     if let r=response as? HTTPURLResponse,r.statusCode != 200{NSLog("Mizuki APNs registration returned %d",r.statusCode)}
  }catch {NSLog("Mizuki APNs registration failed: %@",String(describing:type(of:error)))}
 }
}
