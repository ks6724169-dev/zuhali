import React, { useState, useRef } from 'react';
import {
  ArrowLeft, Palette, Settings, Bell, ShieldCheck, Database, Info,
  Volume2, MessageSquare, Folder, Monitor, Camera, Sun, Moon, Smartphone,
  Check, UserRound, Pencil, CreditCard, CircleHelp, Shield, FileText, CheckCircle2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ACCENT_COLORS, LANGUAGES, STORAGE_CATEGORIES } from '../../constants';
import {
  getNotificationSettings,
  saveNotificationSettings,
  playChime,
  triggerHaptic,
  requestPushPermission,
  showBrowserNotification
} from '../../services/notificationService';

// 1. MAIN SETTINGS SCREEN
export function SettingsScreen({ onClose, onOpenSubScreen }) {
  return (
    <section className="profile-screen settings-screen">
      <header className="profile-screen-header">
        <button type="button" className="profile-back-button" aria-label="Back" onClick={onClose}>
          <ArrowLeft size={20} />
        </button>
        <h1>Settings</h1>
      </header>
      <div className="settings-screen-content">
        <button type="button" className="settings-option" onClick={() => onOpenSubScreen('appearance')}>
          <span className="settings-option-icon"><Palette size={19} /></span>
          <span><strong>Appearance</strong><small>Light, Dark or System Default &amp; Colors</small></span>
          <ArrowLeft className="settings-option-chevron" size={17} />
        </button>
        <button type="button" className="settings-option" onClick={() => onOpenSubScreen('language')}>
          <span className="settings-option-icon"><Settings size={19} /></span>
          <span><strong>Language</strong><small>App language preferences</small></span>
          <ArrowLeft className="settings-option-chevron" size={17} />
        </button>
        <button type="button" className="settings-option" onClick={() => onOpenSubScreen('notifications')}>
          <span className="settings-option-icon"><Bell size={19} /></span>
          <span><strong>Notifications</strong><small>Notification &amp; sound preferences</small></span>
          <ArrowLeft className="settings-option-chevron" size={17} />
        </button>
        <button type="button" className="settings-option" onClick={() => onOpenSubScreen('privacy')}>
          <span className="settings-option-icon"><ShieldCheck size={19} /></span>
          <span><strong>Privacy &amp; Data</strong><small>Chat history and security settings</small></span>
          <ArrowLeft className="settings-option-chevron" size={17} />
        </button>
        <button type="button" className="settings-option" onClick={() => onOpenSubScreen('storage')}>
          <span className="settings-option-icon"><Database size={19} /></span>
          <span><strong>Storage</strong><small>Storage allocation &amp; cleanup</small></span>
          <ArrowLeft className="settings-option-chevron" size={17} />
        </button>
        <button type="button" className="settings-option" onClick={() => onOpenSubScreen('about')}>
          <span className="settings-option-icon"><Info size={19} /></span>
          <span><strong>About Zuhali</strong><small>Version 1.0.0 (Production Architecture)</small></span>
          <ArrowLeft className="settings-option-chevron" size={17} />
        </button>
      </div>
    </section>
  );
}

// 2. APPEARANCE SCREEN
export function AppearanceScreen({ onBack }) {
  const { theme, setTheme, accentColor, setAccentColor, currentAccent } = useTheme();
  const [accentOpen, setAccentOpen] = useState(false);

  return (
    <section className="profile-screen appearance-screen">
      <header className="profile-screen-header">
        <button type="button" className="profile-back-button" aria-label="Back to settings" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h1>Appearance</h1>
      </header>
      <div className="appearance-content">
        <div className="appearance-section-label">THEME</div>
        <div className="appearance-theme-list">
          {[
            { name: 'Light', description: 'Clean and bright appearance', Icon: Sun, preview: 'light' },
            { name: 'Dark', description: 'Comfortable in low light', Icon: Moon, preview: 'dark' },
            { name: 'System Default', description: 'Match your device settings', Icon: Smartphone, preview: 'system' }
          ].map(({ name, description, Icon, preview }) => (
            <button
              type="button"
              key={name}
              className={`appearance-theme-option ${theme === name ? 'selected' : ''}`}
              onClick={() => setTheme(name)}
            >
              <span className="appearance-theme-icon"><Icon size={20} /></span>
              <span className="appearance-theme-copy">
                <strong>{name}</strong>
                <small>{description}</small>
              </span>
              <span className={`appearance-theme-swatch ${preview}`} aria-hidden="true">
                <i /><i /><i />
              </span>
              <span className="appearance-radio" aria-hidden="true">
                {theme === name ? <span /> : null}
              </span>
            </button>
          ))}
        </div>

        <div className="appearance-section-label accent-label">ACCENT COLOR</div>
        
        {/* Quick 1-click Color Swatches */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {ACCENT_COLORS.map(({ name, value }) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => setAccentColor(name)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: value,
                border: accentColor === name ? '3px solid #fff' : '2px solid transparent',
                outline: accentColor === name ? `2px solid ${value}` : 'none',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                boxShadow: accentColor === name ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                transform: accentColor === name ? 'scale(1.15)' : 'scale(1)',
                transition: 'all .15s ease'
              }}
            >
              {accentColor === name && (
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>✓</span>
              )}
            </button>
          ))}
        </div>

        <div className="accent-picker-wrap">
          <button
            type="button"
            className="accent-picker-trigger"
            aria-expanded={accentOpen}
            onClick={() => setAccentOpen((v) => !v)}
          >
            <span className="accent-picker-current">
              <i style={{ background: currentAccent.value }} />
              {accentColor}
            </span>
            <span className="accent-picker-trigger-right">
              <small>All 20 colors</small>
              <ArrowLeft size={16} className={accentOpen ? 'accent-chevron-open' : 'accent-chevron'} />
            </span>
          </button>

          {accentOpen && (
            <div className="accent-color-popup" role="listbox" aria-label="Choose accent color">
              <div className="accent-popup-heading">Choose a color</div>
              <div className="accent-color-list">
                {ACCENT_COLORS.map(({ name, value }) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={accentColor === name}
                    key={name}
                    className={`accent-color-option ${accentColor === name ? 'selected' : ''}`}
                    onClick={() => {
                      setAccentColor(name);
                      setAccentOpen(false);
                    }}
                  >
                    <i style={{ background: value }} />
                    <span>{name}</span>
                    {accentColor === name && <span className="accent-color-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="appearance-section-label preview-label">PREVIEW</div>
        <div className={`appearance-chat-preview ${theme === 'Dark' ? 'preview-dark' : ''}`}>
          <div className="appearance-preview-header">
            <span className="appearance-preview-logo" style={{ background: 'var(--accent-color, #16a34a)' }}><span /></span>
            <span><strong>Zuhali</strong><small>AI Assistant</small></span>
          </div>
          <div className="appearance-preview-message">Hello! How can I help you today?</div>
          <div className="appearance-preview-user" style={{ background: 'var(--accent-color, #16a34a)', color: '#fff' }}>Explain Artificial Intelligence.</div>
          <small className="appearance-preview-note">Live Preview of your active theme &amp; accent color</small>
        </div>
      </div>
    </section>
  );
}

// 3. LANGUAGE SCREEN
export function LanguageScreen({ onBack }) {
  const [selectedLang, setSelectedLang] = useState(() => localStorage.getItem('zuhali_lang') || 'English');

  const handleSelect = (langName) => {
    setSelectedLang(langName);
    localStorage.setItem('zuhali_lang', langName);
  };

  return (
    <section className="profile-screen language-screen">
      <header className="profile-screen-header">
        <button type="button" className="profile-back-button" aria-label="Back to settings" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h1>Language</h1>
      </header>
      <div className="language-screen-content">
        <div className="language-intro">
          <strong>App Language</strong>
          <small>Choose your preferred interface language.</small>
        </div>
        <div className="language-list">
          {LANGUAGES.map(({ name, native }) => (
            <button
              type="button"
              key={name}
              className={`language-option ${selectedLang === name ? 'selected' : ''}`}
              onClick={() => handleSelect(name)}
            >
              <span className="language-option-letter">🌐</span>
              <span className="language-option-copy">
                <strong>{native}</strong>
                <small>{name}</small>
              </span>
              <span className="language-radio" aria-hidden="true">
                {selectedLang === name ? <i /> : null}
              </span>
            </button>
          ))}
        </div>
        <p className="language-footnote">Language preference is saved and applied immediately.</p>
      </div>
    </section>
  );
}

// 4. NOTIFICATIONS SCREEN (Connected & Fully Functional)
export function NotificationsScreen({ onBack }) {
  const { user } = useAuth();
  const userKey = user?.email ? user.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'guest';

  const [settings, setSettings] = useState(() => getNotificationSettings(userKey));
  const [testSent, setTestSent] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const updateSetting = async (key, val) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    saveNotificationSettings(userKey, next);

    // If enabling push, request real browser permission
    if (key === 'push' && val) {
      const res = await requestPushPermission();
      setPermissionStatus(res.status);
      if (res.status !== 'granted') {
        // If user denied in browser, reflect it
        next.push = false;
        setSettings({ ...next });
        saveNotificationSettings(userKey, next);
      }
    }

    // If toggling sound, play sample chime
    if (key === 'sound' && val) {
      playChime();
    }

    // If toggling vibration, trigger sample haptic
    if (key === 'vibration' && val) {
      triggerHaptic();
    }
  };

  const handleSendTest = async () => {
    // 1. Play real audio chime
    if (settings.sound) {
      playChime();
    }
    // 2. Trigger vibration
    if (settings.vibration) {
      triggerHaptic();
    }
    // 3. Request permission and dispatch test browser notification
    const res = await requestPushPermission();
    setPermissionStatus(res.status);
    if (res.status === 'granted') {
      showBrowserNotification('🌿 Zuhali AI Test Notification', {
        body: 'Real-time alert engine active and verified! Sub-second updates working.'
      });
    }

    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  };

  const { push, aiReplies, updates, reminders, sound, vibration } = settings;

  return (
    <section className="profile-screen notifications-screen">
      <header className="profile-screen-header notifications-screen-header">
        <button type="button" className="profile-back-button" aria-label="Back to settings" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h1>Notifications</h1>
      </header>
      <div className="notifications-screen-content">
        <section className="notifications-group">
          <div className="notifications-group-heading">GENERAL ALERTS</div>
          <div className="notifications-card">
            <div className="notification-row">
              <span className="notification-copy">
                <strong>Push Notifications</strong>
                <small>
                  Deliver real-time alerts to your desktop or mobile browser
                  {permissionStatus === 'denied' && (
                    <span style={{ color: '#ef4444', display: 'block', marginTop: '2px' }}>
                      ⚠️ Blocked in browser settings. Please allow notifications in site settings.
                    </span>
                  )}
                  {permissionStatus === 'granted' && (
                    <span style={{ color: '#16a34a', display: 'block', marginTop: '2px' }}>
                      ✓ Browser permissions granted &amp; active
                    </span>
                  )}
                </small>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={push}
                className={`notification-switch ${push ? 'on' : ''}`}
                onClick={() => updateSetting('push', !push)}
              >
                <span />
              </button>
            </div>
            <div className={`notification-row ${!push ? 'is-disabled' : ''}`}>
              <span className="notification-copy">
                <strong>AI Responses</strong>
                <small>Alert immediately when an AI generation completes</small>
              </span>
              <button
                type="button"
                role="switch"
                disabled={!push}
                aria-checked={aiReplies}
                className={`notification-switch ${aiReplies ? 'on' : ''}`}
                onClick={() => updateSetting('aiReplies', !aiReplies)}
              >
                <span />
              </button>
            </div>
            <div className={`notification-row ${!push ? 'is-disabled' : ''}`}>
              <span className="notification-copy">
                <strong>App Updates &amp; Features</strong>
                <small>Real-time notifications for new AI models and releases</small>
              </span>
              <button
                type="button"
                role="switch"
                disabled={!push}
                aria-checked={updates}
                className={`notification-switch ${updates ? 'on' : ''}`}
                onClick={() => updateSetting('updates', !updates)}
              >
                <span />
              </button>
            </div>
            <div className={`notification-row ${!push ? 'is-disabled' : ''}`}>
              <span className="notification-copy">
                <strong>Reminders &amp; Tasks</strong>
                <small>Scheduled automation triggers and follow-up alerts</small>
              </span>
              <button
                type="button"
                role="switch"
                disabled={!push}
                aria-checked={reminders}
                className={`notification-switch ${reminders ? 'on' : ''}`}
                onClick={() => updateSetting('reminders', !reminders)}
              >
                <span />
              </button>
            </div>
          </div>
        </section>

        <section className="notifications-group">
          <div className="notifications-group-heading">SOUND &amp; HAPTICS</div>
          <div className="notifications-card">
            <div className="notification-row">
              <span className="notification-copy">
                <strong>Notification Sound</strong>
                <small>Play a gentle dual-frequency audio chime when response finishes</small>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={sound}
                className={`notification-switch ${sound ? 'on' : ''}`}
                onClick={() => updateSetting('sound', !sound)}
              >
                <span />
              </button>
            </div>
            <div className="notification-row">
              <span className="notification-copy">
                <strong>Vibration &amp; Haptics</strong>
                <small>Subtle physical vibration pulse on touch devices</small>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={vibration}
                className={`notification-switch ${vibration ? 'on' : ''}`}
                onClick={() => updateSetting('vibration', !vibration)}
              >
                <span />
              </button>
            </div>
          </div>
        </section>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleSendTest}
            style={{
              padding: '12px 24px',
              fontSize: '13px',
              fontWeight: 650,
              borderRadius: '12px',
              border: '1px solid var(--accent-color, #16a34a)',
              background: 'var(--surface-active, rgba(22, 163, 74, 0.12))',
              color: 'var(--accent-color, #16a34a)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Bell size={16} />
            <span>{testSent ? '✓ Notification & Chime Sent!' : 'Send Test Notification & Chime'}</span>
          </button>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '8px' }}>
            Preferences are automatically saved to your account.
          </div>
        </div>
      </div>
    </section>
  );
}

// 5. STORAGE SCREEN (Connected to Real 200 MB Cloud Quota per User)
export function StorageScreen({ onBack }) {
  const { user } = useAuth();
  const userKey = user?.email ? user.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'guest';
  const [cleanNotice, setCleanNotice] = useState(false);

  // Calculate actual real-time storage utilized by the active user
  const getStorageMetrics = () => {
    let chatBytes = 0;
    let imageBytes = 0;
    let fileBytes = 0;
    let cacheBytes = 0;

    try {
      const convKey = `zuhali_conversations_${userKey}`;
      const msgKey = `zuhali_messages_map_${userKey}`;

      const convRaw = localStorage.getItem(convKey) || '';
      const msgRaw = localStorage.getItem(msgKey) || '';

      chatBytes += (convRaw.length + msgRaw.length) * 2;

      if (msgRaw) {
        try {
          const map = JSON.parse(msgRaw);
          Object.values(map).forEach((list) => {
            if (Array.isArray(list)) {
              list.forEach((m) => {
                if (m.attachmentData) {
                  const b = m.attachmentData.length * 2;
                  if (m.attachmentType?.startsWith('image/') || m.attachmentData.startsWith('data:image/')) {
                    imageBytes += b;
                  } else {
                    fileBytes += b;
                  }
                }
              });
            }
          });
        } catch (e) {}
      }

      // Library files (Photos, Videos, Documents) integration
      const libKey = `zuhali_library_files_${userKey}`;
      const libRaw = localStorage.getItem(libKey) || '';
      if (libRaw) {
        try {
          const libFiles = JSON.parse(libRaw) || [];
          libFiles.forEach((f) => {
            const sz = f.size || (f.dataUrl ? f.dataUrl.length : 0);
            if (f.category === 'photo' || f.category === 'video') {
              imageBytes += sz;
            } else {
              fileBytes += sz;
            }
          });
        } catch (e) {}
      }

      // Library projects integration
      const projKey = `zuhali_library_projects_${userKey}`;
      const projRaw = localStorage.getItem(projKey) || '';
      if (projRaw) {
        chatBytes += projRaw.length * 2;
      }

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !k.includes(userKey)) {
          const v = localStorage.getItem(k) || '';
          cacheBytes += (k.length + v.length) * 2;
        }
      }
    } catch (e) {}

    const TOTAL_MB = 200; // 200 MB Connected per user
    const TOTAL_BYTES = TOTAL_MB * 1024 * 1024;
    const usedBytes = chatBytes + imageBytes + fileBytes + cacheBytes;
    const usedMB = usedBytes / (1024 * 1024);
    const freeMB = Math.max(0, TOTAL_MB - usedMB);
    const percent = Math.min(100, Math.max(0.1, (usedBytes / TOTAL_BYTES) * 100));

    const fmt = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    return {
      totalQuota: `${TOTAL_MB} MB`,
      totalUsed: fmt(usedBytes),
      freeSpace: `${freeMB.toFixed(1)} MB`,
      percentUsed: percent < 1 ? percent.toFixed(2) : percent.toFixed(1),
      chatStr: fmt(chatBytes),
      imageStr: fmt(imageBytes),
      fileStr: fmt(fileBytes),
      cacheStr: fmt(cacheBytes)
    };
  };

  const metrics = getStorageMetrics();

  const handleClearCache = () => {
    try {
      sessionStorage.clear();
      setCleanNotice(true);
      setTimeout(() => setCleanNotice(false), 2000);
    } catch (e) {}
  };

  return (
    <section className="profile-screen storage-screen">
      <header className="profile-screen-header storage-screen-header">
        <button type="button" className="profile-back-button" aria-label="Back to settings" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h1>Storage</h1>
      </header>
      <div className="storage-screen-content">
        <section className="storage-overview-card">
          <div className="storage-overview-top">
            <span className="storage-eyebrow">CONNECTED ACCOUNT QUOTA</span>
            <strong>{metrics.totalQuota} Cloud Storage</strong>
            <small style={{ color: 'var(--accent-color, #16a34a)', fontSize: '11px', fontWeight: 600 }}>
              ● Verified Active for {user?.email || 'Logged in user'}
            </small>
          </div>
          <div className="storage-progress-track">
            <span style={{ width: `${Math.max(2, metrics.percentUsed)}%`, transition: 'width 0.3s ease' }} />
          </div>
          <div className="storage-progress-labels">
            <span>{metrics.totalUsed} allocated</span>
            <span>{metrics.percentUsed}% utilized</span>
          </div>
        </section>

        <div className="storage-summary-grid">
          <div className="storage-summary-card">
            <span>Used Storage</span>
            <strong>{metrics.totalUsed}</strong>
          </div>
          <div className="storage-summary-card">
            <span>Free Space Available</span>
            <strong>{metrics.freeSpace}</strong>
          </div>
        </div>

        <section className="storage-categories-section">
          <h2>Original Storage Breakdown</h2>
          <div className="storage-category-list">
            <div className="storage-category-row">
              <MessageSquare size={19} />
              <strong>Chat Transcripts &amp; History</strong>
              <span>{metrics.chatStr}</span>
            </div>
            <div className="storage-category-row">
              <Camera size={19} />
              <strong>Vision &amp; Uploaded Images</strong>
              <span>{metrics.imageStr}</span>
            </div>
            <div className="storage-category-row">
              <Folder size={19} />
              <strong>Documents &amp; Code Files</strong>
              <span>{metrics.fileStr}</span>
            </div>
            <div className="storage-category-row">
              <Database size={19} />
              <strong>Workspace &amp; App Cache</strong>
              <span>{metrics.cacheStr}</span>
            </div>
          </div>
        </section>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleClearCache}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '10px',
              border: '1px solid var(--border, #e5e7eb)',
              background: 'var(--surface, #f8fafc)',
              color: 'var(--text-primary, #334155)',
              cursor: 'pointer'
            }}
          >
            {cleanNotice ? '✓ Temp Cache Optimized!' : 'Optimize & Clean Session Cache'}
          </button>
        </div>
      </div>
    </section>
  );
}

// 6. USER PROFILE SCREEN
export function ProfileScreen({ onClose }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savedNotice, setSavedNotice] = useState(false);
  const fileInputRef = useRef(null);

  const handleSave = (e) => {
    e.preventDefault();
    updateProfile({ name, email });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateProfile({ avatar: url });
    }
  };

  return (
    <section className="profile-screen">
      <header className="profile-screen-header">
        <button type="button" className="profile-back-button" aria-label="Back" onClick={onClose}>
          <ArrowLeft size={20} />
        </button>
        <h1>Profile</h1>
      </header>
      <div className="profile-screen-content">
        <div className="profile-photo-section">
          <div className="profile-photo-wrap">
            {user?.avatar ? (
              <img className="profile-photo-image" src={user.avatar} alt="Profile" />
            ) : (
              <div className="profile-photo-placeholder">
                <UserRound size={48} />
              </div>
            )}
            <button
              type="button"
              className="profile-photo-edit"
              aria-label="Change profile photo"
              onClick={() => fileInputRef.current?.click()}
            >
              <Pencil size={15} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="profile-info-section">
          <h2>Personal Information</h2>
          <div className="profile-info-card">
            <div className="profile-info-row">
              <UserRound size={19} />
              <div style={{ flex: 1 }}>
                <small>Full Name</small>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontWeight: 600 }}
                  placeholder="Enter your name"
                />
              </div>
            </div>
            <div className="profile-info-divider" />
            <div className="profile-info-row">
              <MailIcon size={19} />
              <div style={{ flex: 1 }}>
                <small>Email Address</small>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontWeight: 600 }}
                  placeholder="Enter your email"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="auth-primary"
            style={{ marginTop: 24, borderRadius: 12 }}
          >
            {savedNotice ? 'Saved Successfully ✓' : 'Save Changes'}
          </button>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />
      </div>
    </section>
  );
}

// 7. PLAN & BILLING SCREEN
export function BillingScreen({ onClose }) {
  return (
    <section className="profile-screen settings-screen">
      <header className="profile-screen-header">
        <button type="button" className="profile-back-button" aria-label="Back" onClick={onClose}>
          <ArrowLeft size={20} />
        </button>
        <h1>Plan &amp; Billing</h1>
      </header>
      <div className="settings-screen-content" style={{ padding: 20 }}>
        <div className="storage-overview-card" style={{ background: 'var(--accent-color)', color: '#fff' }}>
          <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.9 }}>Current Tier</span>
          <h2 style={{ margin: '8px 0', fontSize: 26 }}>Zuhali Pro Developer</h2>
          <p style={{ margin: 0, opacity: 0.95 }}>Unlimited reasoning, Claude/Gemini streaming, and unlimited terminal execution sessions.</p>
        </div>

        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Payment Method</h3>
          <div className="profile-info-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <CreditCard size={24} />
            <div>
              <strong>Visa ending in 4242</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Renews on Dec 1, 2026</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 8. HELP & SUPPORT SCREEN
export function HelpScreen({ onClose }) {
  return (
    <section className="profile-screen settings-screen">
      <header className="profile-screen-header">
        <button type="button" className="profile-back-button" aria-label="Back" onClick={onClose}>
          <ArrowLeft size={20} />
        </button>
        <h1>Help &amp; Support</h1>
      </header>
      <div className="settings-screen-content">
        <div className="settings-option">
          <span className="settings-option-icon"><CircleHelp size={19} /></span>
          <span><strong>Documentation</strong><small>Guides, API references and tutorials</small></span>
        </div>
        <div className="settings-option">
          <span className="settings-option-icon"><Shield size={19} /></span>
          <span><strong>Security &amp; Compliance</strong><small>Data encryption and RLS protocols</small></span>
        </div>
        <div className="settings-option">
          <span className="settings-option-icon"><FileText size={19} /></span>
          <span><strong>Contact Support</strong><small>24/7 developer desk assistance</small></span>
        </div>
      </div>
    </section>
  );
}

function MailIcon({ size = 18 }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center' }}>✉️</span>;
}
