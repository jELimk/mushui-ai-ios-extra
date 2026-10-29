import Foundation
import Combine
import AVFoundation
import CallKit
import WebRTC

// Only signaling goes to the server. Audio uses native WebRTC, independent of WKWebView timers.
@MainActor final class NativeCalls: NSObject, ObservableObject, CXProviderDelegate, RTCPeerConnectionDelegate {
    @Published var visible = false
    @Published var incoming = false
    @Published var peer = ""
    @Published var message = ""
    @Published var remoteCamera:RTCVideoTrack?
    @Published var remoteScreen:RTCVideoTrack?
    @Published var cameraShowing=false
    @Published var screenShowing=false
    @Published var cameraEnabled=false
    private var capturer:RTCCameraVideoCapturer?
    private var localVideo:RTCVideoTrack?
    @Published var muted = false
    @Published var lastError = ""
    private var base = "", token = "", callID = ""
    private var cursor = 0, polling = false
    private var callUUID: UUID?
    private var offer: [String: Any]?
    private var queuedICE: [[String: Any]] = [], remoteICE: [[String: Any]] = []
    private var pc: RTCPeerConnection?
    private var track: RTCAudioTrack?
    private var timer: Timer?
    private let controller = CXCallController()
    private let provider: CXProvider
    private let factory: RTCPeerConnectionFactory
    override init() {
        let config = CXProviderConfiguration(localizedName: "沐水")
        config.supportsVideo = true
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.generic]
        provider = CXProvider(configuration: config)
        RTCInitializeSSL()
        factory = RTCPeerConnectionFactory(encoderFactory: RTCDefaultVideoEncoderFactory(), decoderFactory: RTCDefaultVideoDecoderFactory())
        super.init()
        RTCAudioSession.sharedInstance().useManualAudio = true
        provider.setDelegate(self, queue: .main)
        timer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self] _ in Task { @MainActor in await self?.poll() } }
    }
    func receive(_ b: [String: Any]) {
        let nextBase = b["server"] as? String ?? "", nextToken = b["token"] as? String ?? ""
        if base != nextBase || token != nextToken {
            if visible { endFromUI() }
            base = nextBase.trimmingCharacters(in: CharacterSet(charactersIn: "/")); token = nextToken; cursor = 0
        }
        switch b["command"] as? String {
        case "start":
            guard !visible, !token.isEmpty, let target = b["peer"] as? String else { return }
            peer = target; callUUID = UUID(); incoming = false; visible = true; message = "正在準備通話…"
            let action = CXStartCallAction(call: callUUID!, handle: CXHandle(type: .generic, value: target))
            controller.request(CXTransaction(action: action)) { [weak self] error in if let error { Task { @MainActor in self?.fail(error) } } }
        case "end": endFromUI()
        default: break
        }
    }
    private func request(_ path: String, _ body: [String: Any]? = nil) async throws -> [String: Any] {
        guard let url = URL(string: base + "/v1/calls/" + path), url.scheme == "https", !token.isEmpty else { throw problem("請先登入好友帳號") }
        var r = URLRequest(url: url); r.timeoutInterval = 30
        r.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        if let body { r.httpMethod = "POST"; r.setValue("application/json", forHTTPHeaderField: "Content-Type"); r.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await URLSession.shared.data(for: r)
        let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw problem(value["error"] as? String ?? "通話伺服器錯誤") }
        return value
    }
    private func problem(_ text: String) -> NSError { NSError(domain: "MushuiCall", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
    private func prepare(incoming:Bool=false) async throws {
        let allowed = await withCheckedContinuation { (c: CheckedContinuation<Bool, Never>) in AVAudioSession.sharedInstance().requestRecordPermission { c.resume(returning: $0) } }
        guard allowed else { throw problem("需要麥克風權限，請到 iPhone 設定允許") }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
        let config = try await request("config")
        let rtc = RTCConfiguration(); rtc.sdpSemantics = .unifiedPlan; rtc.continualGatheringPolicy = .gatherContinually
        rtc.iceServers = (config["iceServers"] as? [[String: Any]] ?? []).map { d in
            let urls = d["urls"] as? [String] ?? [d["urls"] as? String ?? ""]
            return RTCIceServer(urlStrings: urls, username: d["username"] as? String, credential: d["credential"] as? String)
        }
        guard let connection = factory.peerConnection(with: rtc, constraints: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: ["DtlsSrtpKeyAgreement": "true"]), delegate: self) else { throw problem("無法建立 WebRTC 連線") }
        pc = connection
        let source = factory.audioSource(with: RTCMediaConstraints(mandatoryConstraints: ["googAutoGainControl": "true", "googNoiseSuppression": "true", "googEchoCancellation": "true"], optionalConstraints: nil))
        track = factory.audioTrack(with: source, trackId: "mushui-audio")
        if let track { connection.add(track, streamIds: ["mushui"]) };if !incoming{let video=RTCRtpTransceiverInit();video.direction = .sendRecv;_ = connection.addTransceiver(of:.video,init:video);_ = connection.addTransceiver(of:.video,init:video)}
    }
    private func description(answer: Bool) async throws -> RTCSessionDescription {
        guard let pc else { throw problem("通話未初始化") }
        return try await withCheckedThrowingContinuation { continuation in
            let completion: (RTCSessionDescription?, Error?) -> Void = { sdp, error in
                if let sdp { continuation.resume(returning: sdp) } else { continuation.resume(throwing: error ?? NSError(domain: "MushuiCall", code: 1, userInfo: [NSLocalizedDescriptionKey: "無法協商通話"])) }
            }
            let constraints = RTCMediaConstraints(mandatoryConstraints: ["OfferToReceiveAudio": "true"], optionalConstraints: nil)
            if answer { pc.answer(for: constraints, completionHandler: completion) } else { pc.offer(for: constraints, completionHandler: completion) }
        }
    }
    private func local(_ s: RTCSessionDescription) async throws {
        guard let pc else { throw problem("通話未初始化") }
        try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in pc.setLocalDescription(s) { error in if let error { c.resume(throwing: error) } else { c.resume() } } }
    }
    private func remote(_ d: [String: Any]) async throws {
        guard let pc, let sdp = d["sdp"] as? String else { throw problem("無效的通話描述") }
        let s = RTCSessionDescription(type: d["type"] as? String == "offer" ? .offer : .answer, sdp: sdp)
        try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in pc.setRemoteDescription(s) { error in if let error { c.resume(throwing: error) } else { c.resume() } } }
        let waiting = remoteICE; remoteICE = []; for ice in waiting { addICE(ice) }
    }
    private func addICE(_ d: [String: Any]) {
        guard let text = d["candidate"] as? String else { return }
        if pc?.remoteDescription == nil { remoteICE.append(d); return }
        let ice = RTCIceCandidate(sdp: text, sdpMLineIndex: (d["sdpMLineIndex"] as? NSNumber)?.int32Value ?? 0, sdpMid: d["sdpMid"] as? String)
        pc?.add(ice) { _ in }
    }
    private func sendICE(_ d: [String: Any]) async {
        if callID.isEmpty { queuedICE.append(d); return }
        _ = try? await request("ice", ["id": callID, "candidate": d])
    }
    private func flushICE() async { let pending = queuedICE; queuedICE = []; for d in pending { await sendICE(d) } }
    private func start() async throws {
        try await prepare(); let s = try await description(answer: false); try await local(s)
        let r = try await request("start", ["to": peer, "offer": ["type": "offer", "sdp": s.sdp]])
        guard let id = r["id"] as? String else { throw problem("伺服器未建立通話") }; callID = id; await flushICE(); message = "等待對方接聽…"
        if let uuid = callUUID { provider.reportOutgoingCall(with: uuid, startedConnectingAt: Date()) }
    }
    private func answer() async throws {
        guard let offer else { throw problem("通話已結束") }; incoming = false
        try await prepare(incoming:true); try await remote(offer); let s = try await description(answer: true); try await local(s)
        _ = try await request("answer", ["id": callID, "answer": ["type": "answer", "sdp": s.sdp]])
        await flushICE(); message = "正在連線…"
    }
    func acceptFromUI() { guard let uuid = callUUID else { return }; controller.request(CXTransaction(action: CXAnswerCallAction(call: uuid))) { [weak self] error in if let error { Task { @MainActor in self?.fail(error) } } } }
    func endFromUI() { guard let uuid = callUUID else { cleanup(); return }; controller.request(CXTransaction(action: CXEndCallAction(call: uuid))) { [weak self] error in if error != nil { Task { @MainActor in await self?.end() } } } }
    func toggleMute() { muted.toggle(); track?.isEnabled = !muted }
    private func end() async { if !callID.isEmpty { _ = try? await request("end", ["id": callID]) }; cleanup() }
    private func cleanup() {
        capturer?.stopCapture();capturer=nil;localVideo=nil;remoteCamera=nil;remoteScreen=nil;cameraEnabled=false;cameraShowing=false;screenShowing=false;
        pc?.close(); pc = nil; track = nil; offer = nil; queuedICE = []; remoteICE = []
        callID = ""; callUUID = nil; visible = false; incoming = false; muted = false
        RTCAudioSession.sharedInstance().isAudioEnabled = false
    }
    private func fail(_ error: Error) { message = error.localizedDescription; lastError = error.localizedDescription; if let uuid = callUUID { provider.reportCall(with: uuid, endedAt: Date(), reason: .failed) }; Task { await end() } }
    private func poll() async {
        guard !token.isEmpty, !polling else { return }; polling = true; defer { polling = false }
        do {
            let r = try await request("poll?since=\(cursor)"), calls = r["calls"] as? [[String: Any]] ?? []
            for e in r["events"] as? [[String: Any]] ?? [] {
                cursor = max(cursor, (e["id"] as? NSNumber)?.intValue ?? 0)
                guard let id = e["callid"] as? String, let current = calls.first(where: { $0["id"] as? String == id }), ["ringing", "active"].contains(current["status"] as? String ?? ""), let payload = e["payload"] as? [String: Any] else { continue }
                switch e["kind"] as? String {
                case "offer":
                    if callID == id { continue }
                    if visible { _ = try? await request("end", ["id": id]); continue }
                    callID = id; callUUID = UUID(); peer = e["sender"] as? String ?? "好友"; offer = payload; incoming = true; visible = true; message = "好友語音來電"
                    let update = CXCallUpdate(); update.remoteHandle = CXHandle(type: .generic, value: peer); update.hasVideo = false
                    provider.reportNewIncomingCall(with: callUUID!, update: update) { [weak self] error in if let error { Task { @MainActor in self?.fail(error) } } }
                case "answer": if callID == id { try await remote(payload) }
                case "ice": if callID == id { addICE(payload) }
                case "media": if callID == id { cameraShowing=payload["camera"] as? Bool ?? false;screenShowing=payload["screen"] as? Bool ?? false }
                default: break
                }
            }
            if !callID.isEmpty, let c = calls.first(where: { $0["id"] as? String == callID }), !["ringing", "active"].contains(c["status"] as? String ?? "") {
                if let uuid = callUUID { provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded) }; cleanup()
            }
        } catch { if visible { message = "通話連線：" + error.localizedDescription } }
    }
    // CallKit owns audio activation. Native WebRTC continues when the web UI is suspended.
    func providerDidReset(_ provider: CXProvider) { Task { await end() } }
    func provider(_ provider: CXProvider, perform action: CXStartCallAction) { Task { do { try await start(); action.fulfill() } catch { action.fail(); fail(error) } } }
    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) { Task { do { try await answer(); action.fulfill() } catch { action.fail(); fail(error) } } }
    func provider(_ provider: CXProvider, perform action: CXEndCallAction) { Task { await end(); action.fulfill() } }
    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) { muted = action.isMuted; track?.isEnabled = !muted; action.fulfill() }
    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) { RTCAudioSession.sharedInstance().audioSessionDidActivate(audioSession); RTCAudioSession.sharedInstance().isAudioEnabled = true }
    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) { RTCAudioSession.sharedInstance().audioSessionDidDeactivate(audioSession); RTCAudioSession.sharedInstance().isAudioEnabled = false }
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        let d: [String: Any] = ["candidate": candidate.sdp, "sdpMLineIndex": candidate.sdpMLineIndex, "sdpMid": candidate.sdpMid ?? ""]
        Task { @MainActor in await sendICE(d) }
    }
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        Task { @MainActor in
            guard self.pc === peerConnection else { return }
            if newState == .connected || newState == .completed { message = "通話中 · 可切換到背景或鎖屏"; if let uuid = callUUID { provider.reportOutgoingCall(with: uuid, connectedAt: Date()) } }
            if newState == .failed { fail(problem("通話連線失敗，請檢查 TURN 設定與網路")) }
        }
    }

    func peerConnection(_ connection:RTCPeerConnection,didAdd receiver:RTCRtpReceiver,streams:[RTCMediaStream]){guard let video=receiver.track as? RTCVideoTrack else{return};let mid=connection.transceivers.first(where:{$0.receiver === receiver})?.mid;Task{@MainActor in if mid=="2"{self.remoteScreen=video}else{self.remoteCamera=video}}}
    func toggleCamera(){Task{@MainActor in guard let pc=self.pc else{return};if cameraEnabled{await capturer?.stopCapture();pc.transceivers.first(where:{$0.mid=="1"})?.sender.track=nil;cameraEnabled=false}else{guard await AVCaptureDevice.requestAccess(for:.video)else{message="需要相機權限";return};let source=factory.videoSource(),capture=RTCCameraVideoCapturer(delegate:source);guard let device=RTCCameraVideoCapturer.captureDevices().first(where:{$0.position == .front}) ?? RTCCameraVideoCapturer.captureDevices().first,let format=RTCCameraVideoCapturer.supportedFormats(for:device).first else{return};let track=factory.videoTrack(with:source,trackId:"mushui-camera");localVideo=track;capturer=capture;pc.transceivers.first(where:{$0.mid=="1"})?.sender.track=track;do{try await capture.startCapture(with:device,format:format,fps:min(30,Int(format.videoSupportedFrameRateRanges.first?.maxFrameRate ?? 30)));cameraEnabled=true}catch{message=error.localizedDescription;return}};_ = try? await request("media",["id":callID,"media":["camera":cameraEnabled,"screen":false,"muted":muted]])}}
}
