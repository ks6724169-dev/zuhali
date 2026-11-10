import React, { useState, useRef, useEffect } from 'react';
import {
  SquarePen, Search, MessageSquare, UserRound, Settings,
  CreditCard, CircleHelp, LogOut, MoreHorizontal, Pin, FolderKanban,
  Pencil, Trash2
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({
  isOpen,
  onClose,
  onOpenProfile,
  onOpenSettings,
  onOpenBilling,
  onOpenHelp,
  onOpenLibrary
}) {
  const {
    conversations,
    activeConvId,
    selectChat,
    startNewChat,
    setActiveRenameModal,
    togglePinChat,
    deleteChat
  } = useChat();
  const { user, logout } = useAuth();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [longPressConvId, setLongPressConvId] = useState(null);

  const sidebarTouchStart = useRef(null);
  const longPressTimer = useRef(null);

  // Close popup menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (longPressConvId && !e.target.closest('.sidebar-chat-menu')) {
        setLongPressConvId(null);
      }
      if (profileMenuOpen && !e.target.closest('.chat-sidebar-profile-wrap')) {
        setProfileMenuOpen(false);
      }
    };

    if (longPressConvId || profileMenuOpen) {
      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [longPressConvId, profileMenuOpen]);

  if (!isOpen) return null;

  const filteredChats = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <button
        className="sidebar-backdrop"
        aria-label="Close sidebar"
        onClick={onClose}
      />
      <aside
        className="chat-sidebar"
        onTouchStart={(e) => { sidebarTouchStart.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (sidebarTouchStart.current !== null && sidebarTouchStart.current - e.changedTouches[0].clientX > 70) {
            onClose();
          }
          sidebarTouchStart.current = null;
        }}
      >
        <div className="chat-sidebar-brand">
          <span className="rhynia-leaf"><span /></span>
          <strong>Zuhali</strong>
        </div>

        <nav className="chat-sidebar-actions">
          <button
            type="button"
            onClick={() => {
              startNewChat();
              onClose();
            }}
          >
            <SquarePen size={18} />
            <span>New Chat</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenLibrary();
              onClose();
            }}
          >
            <FolderKanban size={18} />
            <span>Library</span>
          </button>
          <button type="button" onClick={() => setSearchOpen((v) => !v)}>
            <Search size={18} />
            <span>Search</span>
          </button>
        </nav>

        {searchOpen && (
          <input
            className="chat-sidebar-search"
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search chats"
          />
        )}

        <div className="chat-sidebar-section">
          <div className="chat-sidebar-section-label">RECENT CHATS</div>
          <div className="chat-sidebar-recent">
            {filteredChats.length === 0 ? (
              <div style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '13px',
                lineHeight: '1.6'
              }}>
                <MessageSquare size={22} style={{ opacity: 0.35, margin: '0 auto 8px', display: 'block' }} />
                <span>No saved chats yet</span>
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                  Start a new conversation
                </div>
              </div>
            ) : (
              filteredChats.map((conv) => (
                <div key={conv.id} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className={conv.id === activeConvId ? 'is-active-chat' : ''}
                    onClick={() => {
                      if (longPressConvId) {
                        setLongPressConvId(null);
                        return;
                      }
                      selectChat(conv.id);
                      onClose();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setLongPressConvId(conv.id);
                    }}
                    onTouchStart={() => {
                      longPressTimer.current = setTimeout(() => setLongPressConvId(conv.id), 450);
                    }}
                    onTouchEnd={() => clearTimeout(longPressTimer.current)}
                    onTouchMove={() => clearTimeout(longPressTimer.current)}
                    onMouseDown={() => {
                      longPressTimer.current = setTimeout(() => setLongPressConvId(conv.id), 450);
                    }}
                    onMouseUp={() => clearTimeout(longPressTimer.current)}
                    onMouseLeave={() => clearTimeout(longPressTimer.current)}
                  >
                    <MessageSquare size={15} />
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.title}
                    </span>
                    {conv.isPinned && <Pin size={13} style={{ opacity: 0.7 }} />}
                  </button>

                  {longPressConvId === conv.id && (
                    <div
                      className="sidebar-chat-menu"
                      onClick={(e) => e.stopPropagation()}
                      role="menu"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setLongPressConvId(null);
                          setActiveRenameModal({ convId: conv.id, currentTitle: conv.title });
                        }}
                      >
                        <Pencil size={15} />
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          togglePinChat(conv.id);
                          setLongPressConvId(null);
                        }}
                      >
                        <Pin size={15} />
                        <span>{conv.isPinned ? 'Unpin' : 'Pin'}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="danger-item"
                        onClick={() => {
                          deleteChat(conv.id);
                          setLongPressConvId(null);
                        }}
                      >
                        <Trash2 size={15} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-sidebar-profile-wrap">
          {profileMenuOpen && (
            <div className="profile-menu">
              <div className="profile-menu-heading">
                <span className="chat-sidebar-avatar">
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </span>
                <div>
                  <strong>{user?.name || 'Your Account'}</strong>
                  <small>{user?.email || 'Manage account'}</small>
                </div>
              </div>
              <div className="profile-menu-divider" />
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onClose();
                  onOpenProfile();
                }}
              >
                <UserRound size={16} />
                <span>Profile</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onClose();
                  onOpenSettings();
                }}
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onClose();
                  onOpenBilling();
                }}
              >
                <CreditCard size={16} />
                <span>Plan &amp; Billing</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onClose();
                  onOpenHelp();
                }}
              >
                <CircleHelp size={16} />
                <span>Help &amp; Support</span>
              </button>
              <div className="profile-menu-divider" />
              <button
                className="profile-menu-logout"
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onClose();
                  logout();
                }}
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>
          )}

          <button
            className="chat-sidebar-profile"
            type="button"
            aria-label="Open account menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((v) => !v)}
          >
            <span className="chat-sidebar-avatar">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </span>
            <span className="chat-sidebar-profile-name">{user?.name || 'Profile'}</span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
