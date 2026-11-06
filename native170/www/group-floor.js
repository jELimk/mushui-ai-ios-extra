'use strict';
// 3.3.2: AIs in a group call take turns. Every AI runs its own voice session, so left alone they all answer at once.
// One AI holds the floor and the others are silenced; whoever tried to talk gets the next turn. An AI that has listened
// long enough may cut in, and the person talking always wins.
(function (root) {
  class GroupFloor {
    constructor({ mute, tell, now = Date.now, quietMs = 1400, interruptMs = 6000 }) {
      Object.assign(this, { mute, tell, now, quietMs, interruptMs, actors: new Map(), holder: '', startedAt: 0, lastAt: 0, words: '', waiting: [] });
    }
    add(actor, name) { this.actors.set(actor, name); }
    remove(actor) {
      this.actors.delete(actor);
      this.waiting = this.waiting.filter((x) => x !== actor);
      if (this.holder === actor) this.release();
    }
    open() { for (const actor of this.actors.keys()) this.mute(actor, false); }
    give(actor) {
      this.holder = actor; this.startedAt = this.lastAt = this.now(); this.words = '';
      this.waiting = this.waiting.filter((x) => x !== actor);
      for (const other of this.actors.keys()) this.mute(other, other !== actor);
    }
    // Text arriving from an AI is the sign that it has started talking.
    speech(actor, delta) {
      if (!this.actors.has(actor)) return;
      const now = this.now();
      if (!this.holder) this.give(actor);
      if (actor === this.holder) { this.lastAt = now; this.words += delta; return; }
      if (now - this.startedAt >= this.interruptMs) {
        const old = this.holder;
        this.share();
        this.give(actor);
        this.words = delta;
        this.tell(old, 'thinking', this.actors.get(actor) + ' 打斷了你，先停下來聽。');
        return;
      }
      if (!this.waiting.includes(actor)) this.waiting.push(actor);
    }
    // Everyone else hears what was said as quiet context, since AIs can't hear each other's audio.
    share() {
      const words = this.words.trim();
      if (!words) return;
      for (const other of this.actors.keys()) if (other !== this.holder) this.tell(other, 'thinking', this.actors.get(this.holder) + ' 剛才說：' + words.slice(-300));
    }
    release() {
      this.share();
      this.holder = ''; this.words = '';
      const next = this.waiting.shift();
      if (!next) return this.open();
      this.give(next);
      this.tell(next, 'commentary', '現在輪到你說。用一兩句話回應剛才的對話。');
    }
    tick() { if (this.holder && this.now() - this.lastAt >= this.quietMs) this.release(); }
    // A person talking stops the queue; the AIs hear them and stop by themselves.
    person() {
      this.share();
      this.holder = ''; this.words = ''; this.waiting = [];
      this.open();
    }
  }
  root.MizukiGroupFloor = GroupFloor;
})(typeof window === 'undefined' ? globalThis : window);
