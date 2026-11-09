import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import AuthScreen from './features/auth/AuthScreen';
import Sidebar from './components/sidebar/Sidebar';
import ChatWorkspace from './components/chat/ChatWorkspace';
import CodeEditor from './components/editor/CodeEditor';
import Terminal from './Terminal';
import FeedbackModal from './components/chat/FeedbackModal';
import RenameModal from './components/chat/RenameModal';
import {
  SettingsScreen,
  AppearanceScreen,
  LanguageScreen,
  NotificationsScreen,
  StorageScreen,
  ProfileScreen,
  BillingScreen,
  HelpScreen
} from './features/settings/SettingsScreens';
import './styles.css';

function MainAppShell() {
  const { authView } = useAuth();
  const { currentAccent } = useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState(null); // 'settings', 'appearance', 'language', 'notifications', 'storage', 'profile', 'billing', 'help'

  return (
    <main
      className="app-shell"
      style={{ '--accent-color': currentAccent?.value || '#16A34A' }}
    >
      {authView !== 'app' ? (
        <AuthScreen />
      ) : terminalOpen ? (
        <Terminal onClose={() => setTerminalOpen(false)} />
      ) : editorOpen ? (
        <CodeEditor
          onClose={() => setEditorOpen(false)}
          onOpenTerminal={() => setTerminalOpen(true)}
        />
      ) : activeScreen === 'settings' ? (
        <SettingsScreen
          onClose={() => setActiveScreen(null)}
          onOpenSubScreen={(sub) => setActiveScreen(sub)}
        />
      ) : activeScreen === 'appearance' ? (
        <AppearanceScreen onBack={() => setActiveScreen('settings')} />
      ) : activeScreen === 'language' ? (
        <LanguageScreen onBack={() => setActiveScreen('settings')} />
      ) : activeScreen === 'notifications' ? (
        <NotificationsScreen onBack={() => setActiveScreen('settings')} />
      ) : activeScreen === 'storage' ? (
        <StorageScreen onBack={() => setActiveScreen('settings')} />
      ) : activeScreen === 'profile' ? (
        <ProfileScreen onClose={() => setActiveScreen(null)} />
      ) : activeScreen === 'billing' ? (
        <BillingScreen onClose={() => setActiveScreen(null)} />
      ) : activeScreen === 'help' ? (
        <HelpScreen onClose={() => setActiveScreen(null)} />
      ) : (
        <>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpenProfile={() => setActiveScreen('profile')}
            onOpenSettings={() => setActiveScreen('settings')}
            onOpenBilling={() => setActiveScreen('billing')}
            onOpenHelp={() => setActiveScreen('help')}
          />
          <ChatWorkspace
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            onOpenEditor={() => setEditorOpen(true)}
            onOpenTerminal={() => setTerminalOpen(true)}
          />
        </>
      )}

      {/* Global Modals */}
      <FeedbackModal />
      <RenameModal />
    </main>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <MainAppShell />
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
