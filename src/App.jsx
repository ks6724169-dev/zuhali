import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import AuthScreen from './features/auth/AuthScreen';
import Sidebar from './components/sidebar/Sidebar';
import ChatWorkspace from './components/chat/ChatWorkspace';
import FeedbackModal from './components/chat/FeedbackModal';
import RenameModal from './components/chat/RenameModal';
import LibraryScreen from './features/library/LibraryScreen';
import {
  SettingsScreen,
  AppearanceScreen,
  LanguageScreen,
  NotificationsScreen,
  StorageScreen,
  ProfileScreen,
  BillingScreen,
  HelpScreen,
  PrivacyScreen,
  AboutScreen
} from './features/settings/SettingsScreens';
import './styles.css';

function MainAppShell() {
  const { authView } = useAuth();
  const { currentAccent } = useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState(null); // 'settings', 'appearance', 'language', 'notifications', 'privacy', 'storage', 'about', 'profile', 'billing', 'help', 'library'

  return (
    <main
      className="app-shell"
      style={{ '--accent-color': currentAccent?.value || '#16A34A' }}
    >
      {authView !== 'app' ? (
        <AuthScreen />
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
      ) : activeScreen === 'privacy' ? (
        <PrivacyScreen onBack={() => setActiveScreen('settings')} />
      ) : activeScreen === 'storage' ? (
        <StorageScreen onBack={() => setActiveScreen('settings')} />
      ) : activeScreen === 'about' ? (
        <AboutScreen onBack={() => setActiveScreen('settings')} />
      ) : activeScreen === 'profile' ? (
        <ProfileScreen onClose={() => setActiveScreen(null)} />
      ) : activeScreen === 'billing' ? (
        <BillingScreen onClose={() => setActiveScreen(null)} />
      ) : activeScreen === 'help' ? (
        <HelpScreen onClose={() => setActiveScreen(null)} />
      ) : activeScreen === 'library' ? (
        <LibraryScreen onClose={() => setActiveScreen(null)} />
      ) : (
        <>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpenProfile={() => setActiveScreen('profile')}
            onOpenSettings={() => setActiveScreen('settings')}
            onOpenBilling={() => setActiveScreen('billing')}
            onOpenHelp={() => setActiveScreen('help')}
            onOpenLibrary={() => setActiveScreen('library')}
          />
          <ChatWorkspace
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
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
