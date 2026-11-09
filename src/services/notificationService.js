// Real-time Notification & Audio Chime Service for Zuhali AI

export const DEFAULT_NOTIFICATION_SETTINGS = {
  push: true,
  aiReplies: true,
  updates: true,
  reminders: false,
  sound: true,
  vibration: true
};

export const getNotificationSettings = (userKey = 'guest') => {
  try {
    const saved = localStorage.getItem(`zuhali_notifications_${userKey}`);
    if (saved) return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(saved) };
  } catch (e) {}
  return DEFAULT_NOTIFICATION_SETTINGS;
};

export const saveNotificationSettings = (userKey = 'guest', settings) => {
  try {
    localStorage.setItem(`zuhali_notifications_${userKey}`, JSON.stringify(settings));
  } catch (e) {}
};

// 1. Play subtle audio chime using Web Audio API (Zero external audio file needed)
export const playChime = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Smooth dual-tone chime (F#5 -> B5)
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(739.99, now); // F#5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.08); // B5
    gain2.gain.setValueAtTime(0.14, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn('[Audio Chime Warning]:', e);
  }
};

// 2. Trigger Haptic Vibration on mobile devices
export const triggerHaptic = () => {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([80, 40, 80]);
    }
  } catch (e) {}
};

// 3. Request native browser notification permission
export const requestPushPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, status: 'unsupported' };
  }
  if (Notification.permission === 'granted') {
    return { supported: true, status: 'granted' };
  }
  try {
    const perm = await Notification.requestPermission();
    return { supported: true, status: perm };
  } catch (e) {
    return { supported: true, status: Notification.permission };
  }
};

// 4. Send real browser push notification
export const showBrowserNotification = (title, options = {}) => {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const notif = new Notification(title, {
        body: options.body || 'New alert from Zuhali AI',
        icon: options.icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'zuhali-alert',
        ...options
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return notif;
    }
  } catch (e) {
    console.warn('[Notification Dispatch Warning]:', e);
  }
  return null;
};

// 5. Notify when AI reply finishes (triggers chime, vibration & desktop notification)
export const notifyAICompletion = (userKey, promptSnippet = '') => {
  const settings = getNotificationSettings(userKey);
  
  if (settings.sound) {
    playChime();
  }
  if (settings.vibration) {
    triggerHaptic();
  }
  if (settings.push && settings.aiReplies) {
    const bodyText = promptSnippet ? `Response ready for: "${promptSnippet.slice(0, 40)}..."` : 'Your AI response is complete.';
    showBrowserNotification('Zuhali AI — Response Complete', { body: bodyText });
  }
};
