import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Search, Upload, Sparkles, Folder, FolderKanban,
  Image, Video, FileText, Plus, PlusCircle, MoreVertical, X,
  Check, Download, Trash2, MessageSquare, SlidersHorizontal,
  FolderPlus, Eye, Pencil
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  getLibraryFiles, saveLibraryFiles,
  getLibraryProjects, saveLibraryProjects,
  formatFileSize
} from '../../services/libraryService';

export default function LibraryScreen({ onClose }) {
  const { user } = useAuth();
  const { sendMessage, conversations, selectChat, setConversationProject } = useChat();
  const userKey = user?.email ? user.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'guest';

  // Navigation: 'main' | 'upload' | 'photos' | 'videos' | 'documents' | 'projects' | 'ai-generate'
  const [currentView, setCurrentView] = useState('main');
  const [files, setFiles] = useState(() => getLibraryFiles(userKey));
  const [projects, setProjects] = useState(() => getLibraryProjects(userKey));

  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Modals & Popups
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);

  // Project Rename State
  const [renamingProject, setRenamingProject] = useState(null);
  const [renameProjectName, setRenameProjectName] = useState('');

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const fileInputRef = useRef(null);

  // Sync to localStorage
  const updateFiles = (newFiles) => {
    setFiles(newFiles);
    saveLibraryFiles(userKey, newFiles);
  };

  const updateProjects = (newProjects) => {
    setProjects(newProjects);
    saveLibraryProjects(userKey, newProjects);
  };

  // Handle File Upload from device
  const handleFileUpload = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    selectedFiles.forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const category = isImg ? 'photo' : isVid ? 'video' : 'file';

      const reader = new FileReader();
      reader.onload = () => {
        const newItem = {
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: file.name,
          category,
          type: file.type,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          date: 'Today · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
          preview: isImg ? reader.result : null,
          dataUrl: reader.result
        };

        setFiles((prev) => {
          const updated = [newItem, ...prev];
          saveLibraryFiles(userKey, updated);
          return updated;
        });
      };

      if (isImg || file.type.startsWith('text/') || file.size < 5 * 1024 * 1024) {
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          const newItem = {
            id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            name: file.name,
            category,
            type: file.type,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            date: 'Today · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            preview: null
          };
          setFiles((prev) => {
            const updated = [newItem, ...prev];
            saveLibraryFiles(userKey, updated);
            return updated;
          });
        };
        reader.readAsText(file.slice(0, 1024));
      }
    });

    e.target.value = '';
  };

  // Create Project Submit (Page 5)
  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProj = {
      id: 'proj_' + Date.now(),
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
      updatedAt: 'Today',
      fileCount: 0,
      files: []
    };

    updateProjects([newProj, ...projects]);
    setNewProjectName('');
    setNewProjectDesc('');
    setCreateProjectOpen(false);
  };

  // Delete file
  const handleDeleteFile = (id) => {
    updateFiles(files.filter((f) => f.id !== id));
    setActiveMenuId(null);
  };

  // Delete project
  const handleDeleteProject = async (proj) => {
    const id = typeof proj === 'object' ? proj.id : proj;
    const target = projects.find((p) => p.id === id);
    updateProjects(projects.filter((p) => p.id !== id));
    setActiveMenuId(null);

    // If attached to any active conversation, clear project association
    if (conversations && target?.folderName && setConversationProject) {
      conversations.forEach((c) => {
        if (c.activeProject?.folderName === target.folderName) {
          setConversationProject(c.id, null);
        }
      });
    }

    // Sync delete to backend disk
    if (target?.folderName) {
      try {
        const token = localStorage.getItem('zuhali_token');
        await fetch(
          `/api/v1/chat/project?project_name=${encodeURIComponent(target.folderName)}${user?.email ? `&user_email=${encodeURIComponent(user.email)}` : ''}`,
          {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );
      } catch (e) {}
    }
  };

  // Open Project in Chat
  const handleOpenInChat = (proj) => {
    setActiveMenuId(null);
    const existing = conversations?.find(
      (c) => c.activeProject?.folderName === proj.folderName || c.id === proj.conversationId
    );
    if (existing) {
      selectChat(existing.id);
    } else {
      const newConvId = 'conv_' + Date.now();
      if (setConversationProject) {
        setConversationProject(newConvId, proj);
      }
      selectChat(newConvId);
    }
    onClose();
  };

  // Confirm Rename Project
  const handleConfirmRenameProject = async (e) => {
    e?.preventDefault();
    if (!renamingProject || !renameProjectName.trim()) return;

    const oldName = renamingProject.name;
    const oldFolder = renamingProject.folderName;
    const newName = renameProjectName.trim();
    const newFolder = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32) || 'zuhali-project';

    const updated = projects.map((p) =>
      p.id === renamingProject.id
        ? { ...p, name: newName, folderName: newFolder, updatedAt: new Date().toLocaleDateString() }
        : p
    );
    updateProjects(updated);

    if (conversations && setConversationProject) {
      conversations.forEach((c) => {
        if (c.activeProject?.folderName === oldFolder) {
          setConversationProject(c.id, {
            ...c.activeProject,
            name: newName,
            folderName: newFolder
          });
        }
      });
    }

    setRenamingProject(null);
    setRenameProjectName('');

    if (oldFolder && oldFolder !== newFolder) {
      try {
        const token = localStorage.getItem('zuhali_token');
        await fetch(
          `/api/v1/chat/project/rename`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              old_name: oldFolder,
              new_name: newFolder,
              user_email: user?.email || null
            })
          }
        );
      } catch (e) {}
    }
  };

  // Attach to Chat
  const handleSendToChat = (file) => {
    if (file.category === 'photo' && file.preview) {
      sendMessage(`Please analyze this image from my Library: ${file.name}`, {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: file.preview,
        preview: file.preview,
        isImage: true
      });
    } else {
      sendMessage(`Please review this document from my Library: ${file.name}`, {
        name: file.name,
        type: file.type || 'text/plain',
        size: file.size,
        textContent: `[Library Asset: ${file.name} - ${file.sizeFormatted}]`,
        preview: null,
        isImage: false
      });
    }
    onClose();
  };

  // Filtered files according to category / search
  const filteredCategoryFiles = (cat) => {
    return files
      .filter((f) => f.category === cat)
      .filter((f) => !searchTerm || f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const filteredProjects = projects.filter(
    (p) => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="library-screen-overlay" onClick={() => setActiveMenuId(null)}>
      <div className="library-container" onClick={(e) => e.stopPropagation()}>
        
        {/* ============================================================ */}
        {/* 1. MAIN LIBRARY SCREEN (Page 1) */}
        {/* ============================================================ */}
        {currentView === 'main' && (
          <div className="library-page">
            <header className="library-sub-header">
              <button className="library-back-btn profile-back-button" onClick={onClose} aria-label="Back to chat">
                <ArrowLeft size={20} />
              </button>
              <h2>Library</h2>
            </header>

            {/* Search Library */}
            <div className="library-search-wrap">
              <Search size={18} className="library-search-icon" />
              <input
                type="text"
                placeholder="Search library..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Main Action Cards (Matching Settings Options) */}
            <div className="library-cards-list">
              {[
                {
                  id: 'upload',
                  title: 'Upload',
                  desc: 'Upload photos, videos and files',
                  icon: Upload,
                  view: 'upload'
                },
                {
                  id: 'ai-generate',
                  title: 'AI Generate',
                  desc: 'Generate photos, videos and files',
                  icon: Sparkles,
                  view: 'ai-generate'
                },
                {
                  id: 'projects',
                  title: 'Projects',
                  desc: 'Manage your project folders',
                  icon: FolderKanban,
                  view: 'projects'
                }
              ]
                .filter(
                  (item) =>
                    !searchTerm ||
                    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.desc.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="settings-option library-action-card"
                      onClick={() => {
                        setCurrentView(item.view);
                        setSearchTerm('');
                      }}
                    >
                      <span className="settings-option-icon library-card-icon-box">
                        <Icon size={19} />
                      </span>
                      <span className="library-card-info">
                        <strong>{item.title}</strong>
                        <small>{item.desc}</small>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. UPLOAD SCREEN (Page 2) */}
        {/* ============================================================ */}
        {currentView === 'upload' && (
          <div className="library-page">
            <header className="library-sub-header">
              <button className="library-back-btn" onClick={() => setCurrentView('main')} aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <h2>Upload</h2>
              <div style={{ width: 24 }} />
            </header>

            {/* Upload Box Card */}
            <div className="library-upload-box">
              <div className="upload-box-icon">
                <Upload size={28} />
              </div>
              <h3>Upload your files</h3>
              <p>Select photos, videos or documents from your device.</p>
              <button
                type="button"
                className="choose-files-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                + Choose Files
              </button>
            </div>

            {/* Category Cards */}
            <div className="library-section-title">Select Category</div>
            <div className="category-cards-grid">
              <button
                type="button"
                className="category-card"
                onClick={() => { setCurrentView('photos'); setSearchTerm(''); }}
              >
                <Image size={26} />
                <span>Photo</span>
              </button>
              <button
                type="button"
                className="category-card"
                onClick={() => { setCurrentView('videos'); setSearchTerm(''); }}
              >
                <Video size={26} />
                <span>Video</span>
              </button>
              <button
                type="button"
                className="category-card"
                onClick={() => { setCurrentView('documents'); setSearchTerm(''); }}
              >
                <FileText size={26} />
                <span>File</span>
              </button>
            </div>

            {/* Recent Uploads Section */}
            <div className="recent-uploads-header">
              <strong>Recent Uploads</strong>
              <button
                type="button"
                className="see-all-link"
                onClick={() => setCurrentView('photos')}
              >
                See all
              </button>
            </div>

            {files.length === 0 ? (
              <div className="empty-uploads-card">
                <Folder size={28} />
                <span>No uploads yet</span>
              </div>
            ) : (
              <div className="recent-files-compact-list">
                {files.slice(0, 3).map((f) => (
                  <div key={f.id} className="library-file-row">
                    <div className="file-thumbnail">
                      {f.preview ? (
                        <img src={f.preview} alt={f.name} />
                      ) : (
                        <FileText size={20} />
                      )}
                    </div>
                    <div className="file-details">
                      <strong>{f.name}</strong>
                      <small>{f.date} · {f.sizeFormatted}</small>
                    </div>
                    <div className="file-actions-anchor">
                      <button
                        type="button"
                        className="file-more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === f.id ? null : f.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {activeMenuId === f.id && (
                        <div className="file-dropdown-menu">
                          <button onClick={() => handleSendToChat(f)}>
                            <MessageSquare size={14} /> Send to Chat
                          </button>
                          <button onClick={() => handleDeleteFile(f.id)} style={{ color: '#ef4444' }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. CATEGORY VIEW: PHOTOS / VIDEOS / FILES (Page 3) */}
        {/* ============================================================ */}
        {(currentView === 'photos' || currentView === 'videos' || currentView === 'documents') && (
          <div className="library-page">
            <header className="library-sub-header">
              <button className="library-back-btn" onClick={() => setCurrentView('upload')} aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <h2>{currentView === 'photos' ? 'Photos' : currentView === 'videos' ? 'Videos' : 'Files'}</h2>
              <div style={{ width: 38 }} />
            </header>

            {/* Search Bar */}
            <div className="library-search-wrap">
              <Search size={18} className="library-search-icon" />
              <input
                type="text"
                placeholder={`Search ${currentView}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Count header */}
            <div className="library-list-meta">
              <span>
                Recently uploaded · {filteredCategoryFiles(currentView === 'photos' ? 'photo' : currentView === 'videos' ? 'video' : 'file').length}{' '}
                {currentView === 'photos' ? 'Photos' : currentView === 'videos' ? 'Videos' : 'Files'}
              </span>
            </div>

            {/* List of Files */}
            <div className="library-files-list">
              {filteredCategoryFiles(currentView === 'photos' ? 'photo' : currentView === 'videos' ? 'video' : 'file').length === 0 ? (
                <div className="empty-state-box">
                  <Folder size={32} />
                  <p>No {currentView} found</p>
                  <button
                    className="choose-files-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    + Upload Now
                  </button>
                </div>
              ) : (
                filteredCategoryFiles(currentView === 'photos' ? 'photo' : currentView === 'videos' ? 'video' : 'file').map((file) => (
                  <div key={file.id} className="library-file-row">
                    <div
                      className="file-thumbnail"
                      onClick={() => file.preview && setPreviewItem(file)}
                      style={{ cursor: file.preview ? 'pointer' : 'default' }}
                    >
                      {file.preview ? (
                        <img src={file.preview} alt={file.name} />
                      ) : (
                        <FileText size={22} />
                      )}
                    </div>
                    <div className="file-details">
                      <strong>{file.name}</strong>
                      <small>{file.date}</small>
                      <span className="file-size-badge">{file.sizeFormatted}</span>
                    </div>
                    <div className="file-actions-anchor">
                      <button
                        type="button"
                        className="file-more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === file.id ? null : file.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {activeMenuId === file.id && (
                        <div className="file-dropdown-menu">
                          {file.preview && (
                            <button onClick={() => { setPreviewItem(file); setActiveMenuId(null); }}>
                              <Eye size={14} /> Preview
                            </button>
                          )}
                          <button onClick={() => handleSendToChat(file)}>
                            <MessageSquare size={14} /> Send to Chat
                          </button>
                          <button onClick={() => handleDeleteFile(file.id)} style={{ color: '#ef4444' }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 4. PROJECTS SCREEN (Page 4) */}
        {/* ============================================================ */}
        {currentView === 'projects' && (
          <div className="library-page">
            <header className="library-sub-header">
              <button className="library-back-btn" onClick={() => setCurrentView('main')} aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <h2>Projects</h2>
              <button
                type="button"
                className="add-project-icon-btn"
                onClick={() => setCreateProjectOpen(true)}
                aria-label="Create new project"
              >
                <PlusCircle size={22} />
              </button>
            </header>

            {/* Search projects */}
            <div className="library-search-wrap">
              <Search size={18} className="library-search-icon" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Project count */}
            <div className="library-list-meta">
              <span>All Projects · {filteredProjects.length} Projects</span>
            </div>

            {/* Project items list */}
            <div className="library-projects-list">
              {filteredProjects.length === 0 ? (
                <div className="empty-state-box">
                  <FolderKanban size={36} />
                  <p>No projects created yet</p>
                  <button
                    className="choose-files-btn"
                    onClick={() => setCreateProjectOpen(true)}
                  >
                    + Create First Project
                  </button>
                </div>
              ) : (
                filteredProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="library-project-row"
                    style={{ zIndex: activeMenuId === proj.id ? 50 : 1 }}
                  >
                    <div className="project-icon-box">
                      <Folder size={22} />
                    </div>
                    <div className="project-details" onClick={() => handleOpenInChat(proj)} style={{ cursor: 'pointer' }}>
                      <strong>{proj.name}</strong>
                      <small>Updated {proj.updatedAt || 'Recently'} · {proj.fileCount || 0} files</small>
                      {proj.description && <span className="project-desc-snippet">{proj.description}</span>}
                    </div>
                    <div className="file-actions-anchor">
                      <button
                        type="button"
                        className="file-more-btn"
                        aria-label="More options"
                        title="More options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === proj.id ? null : proj.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {activeMenuId === proj.id && (
                        <div className="file-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingProject(proj);
                              setRenameProjectName(proj.name);
                              setActiveMenuId(null);
                            }}
                          >
                            <Pencil size={14} /> Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProject(proj)}
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenInChat(proj)}
                          >
                            <MessageSquare size={14} /> Open in chat
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. AI GENERATE SCREEN (Matching Upload Screen Style)         */}
        {/* ============================================================ */}
        {currentView === 'ai-generate' && (
          <div className="library-page">
            <header className="library-sub-header">
              <button className="library-back-btn" onClick={() => setCurrentView('main')} aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <h2>AI Generate</h2>
              <div style={{ width: 24 }} />
            </header>

            {/* AI Generate Box Card */}
            <div className="library-upload-box">
              <div className="upload-box-icon">
                <Sparkles size={28} />
              </div>
              <h3>Generate with AI</h3>
              <p>Create high quality photos, videos or documents with AI models.</p>
              <button
                type="button"
                className="choose-files-btn"
                onClick={() => {
                  sendMessage("Generate an AI creation for my project.");
                  onClose();
                }}
              >
                + Create with AI
              </button>
            </div>

            {/* Category Cards */}
            <div className="library-section-title">Select Category</div>
            <div className="category-cards-grid">
              <button
                type="button"
                className="category-card"
                onClick={() => { setCurrentView('ai-images'); setSearchTerm(''); }}
              >
                <Image size={26} />
                <span>Photo</span>
              </button>
              <button
                type="button"
                className="category-card"
                onClick={() => { setCurrentView('ai-videos'); setSearchTerm(''); }}
              >
                <Video size={26} />
                <span>Video</span>
              </button>
              <button
                type="button"
                className="category-card"
                onClick={() => { setCurrentView('ai-documents'); setSearchTerm(''); }}
              >
                <FileText size={26} />
                <span>File</span>
              </button>
            </div>

            {/* Recent Generations Section */}
            <div className="recent-uploads-header">
              <strong>Recent Generations</strong>
              <button
                type="button"
                className="see-all-link"
                onClick={() => setCurrentView('ai-images')}
              >
                See all
              </button>
            </div>

            {files.filter((f) => f.isGenerated).length === 0 ? (
              <div className="empty-uploads-card">
                <Sparkles size={28} />
                <span>No AI generations yet</span>
              </div>
            ) : (
              <div className="recent-files-compact-list">
                {files.filter((f) => f.isGenerated).slice(0, 3).map((f) => (
                  <div key={f.id} className="library-file-row">
                    <div className="file-thumbnail">
                      {f.preview ? (
                        <img src={f.preview} alt={f.name} />
                      ) : (
                        <FileText size={20} />
                      )}
                    </div>
                    <div className="file-details">
                      <strong>{f.name}</strong>
                      <small>{f.date} · {f.sizeFormatted}</small>
                    </div>
                    <div className="file-actions-anchor">
                      <button
                        type="button"
                        className="file-more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === f.id ? null : f.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {activeMenuId === f.id && (
                        <div className="file-dropdown-menu">
                          <button onClick={() => handleSendToChat(f)}>
                            <MessageSquare size={14} /> Send to Chat
                          </button>
                          <button onClick={() => handleDeleteFile(f.id)} style={{ color: '#ef4444' }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 6. AI CATEGORY SUB-SCREENS: PHOTOS / VIDEOS / FILES          */}
        {/* ============================================================ */}
        {(currentView === 'ai-images' || currentView === 'ai-videos' || currentView === 'ai-documents') && (
          <div className="library-page">
            <header className="library-sub-header">
              <button className="library-back-btn" onClick={() => setCurrentView('ai-generate')} aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <h2>{currentView === 'ai-images' ? 'AI Photos' : currentView === 'ai-videos' ? 'AI Videos' : 'AI Files'}</h2>
              <div style={{ width: 38 }} />
            </header>

            {/* Search Bar */}
            <div className="library-search-wrap">
              <Search size={18} className="library-search-icon" />
              <input
                type="text"
                placeholder={`Search AI ${currentView.replace('ai-', '')}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Count header */}
            <div className="library-list-meta">
              <span>
                Recently generated · {filteredCategoryFiles(currentView === 'ai-images' ? 'photo' : currentView === 'ai-videos' ? 'video' : 'file').filter(f => f.isGenerated).length}{' '}
                {currentView === 'ai-images' ? 'Photos' : currentView === 'ai-videos' ? 'Videos' : 'Files'}
              </span>
            </div>

            {/* List of Generated Files */}
            <div className="library-files-list">
              {filteredCategoryFiles(currentView === 'ai-images' ? 'photo' : currentView === 'ai-videos' ? 'video' : 'file').filter(f => f.isGenerated).length === 0 ? (
                <div className="empty-state-box">
                  <Sparkles size={32} />
                  <p>No AI {currentView.replace('ai-', '')} generated yet</p>
                  <button
                    className="choose-files-btn"
                    onClick={() => {
                      sendMessage(`Generate an AI ${currentView === 'ai-images' ? 'image' : currentView === 'ai-videos' ? 'video' : 'document'} for my project.`);
                      onClose();
                    }}
                  >
                    + Generate in Chat
                  </button>
                </div>
              ) : (
                filteredCategoryFiles(currentView === 'ai-images' ? 'photo' : currentView === 'ai-videos' ? 'video' : 'file').filter(f => f.isGenerated).map((file) => (
                  <div key={file.id} className="library-file-row">
                    <div
                      className="file-thumbnail"
                      onClick={() => file.preview && setPreviewItem(file)}
                      style={{ cursor: file.preview ? 'pointer' : 'default' }}
                    >
                      {file.preview ? (
                        <img src={file.preview} alt={file.name} />
                      ) : (
                        <FileText size={22} />
                      )}
                    </div>
                    <div className="file-details">
                      <strong>{file.name}</strong>
                      <small>{file.date}</small>
                      <span className="file-size-badge">{file.sizeFormatted}</span>
                    </div>
                    <div className="file-actions-anchor">
                      <button
                        type="button"
                        className="file-more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === file.id ? null : file.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {activeMenuId === file.id && (
                        <div className="file-dropdown-menu">
                          {file.preview && (
                            <button onClick={() => { setPreviewItem(file); setActiveMenuId(null); }}>
                              <Eye size={14} /> Preview
                            </button>
                          )}
                          <button onClick={() => handleSendToChat(file)}>
                            <MessageSquare size={14} /> Send to Chat
                          </button>
                          <button onClick={() => handleDeleteFile(file.id)} style={{ color: '#ef4444' }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: CREATE NEW PROJECT (Page 5) */}
        {/* ============================================================ */}
        {createProjectOpen && (
          <div className="modal-backdrop" onClick={() => setCreateProjectOpen(false)}>
            <div className="create-project-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Create New Project</h2>
              <form onSubmit={handleCreateProject}>
                <div className="project-input-group">
                  <label htmlFor="proj-name">Project Name</label>
                  <input
                    id="proj-name"
                    type="text"
                    required
                    autoFocus
                    placeholder="Enter project name..."
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                </div>

                <div className="project-input-group">
                  <label htmlFor="proj-desc">Description (Optional)</label>
                  <textarea
                    id="proj-desc"
                    placeholder="Enter project description..."
                    rows={3}
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="create-project-submit-btn"
                  disabled={!newProjectName.trim()}
                >
                  Create Project
                </button>

                <button
                  type="button"
                  className="create-project-cancel-btn"
                  onClick={() => setCreateProjectOpen(false)}
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RENAME PROJECT */}
        {renamingProject && (
          <div className="modal-backdrop" onClick={() => setRenamingProject(null)}>
            <div className="create-project-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Rename Project</h2>
              <form onSubmit={handleConfirmRenameProject}>
                <div className="project-input-group">
                  <label htmlFor="rename-proj-name">Project Name</label>
                  <input
                    id="rename-proj-name"
                    type="text"
                    required
                    autoFocus
                    placeholder="Enter new project name..."
                    value={renameProjectName}
                    onChange={(e) => setRenameProjectName(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="create-project-submit-btn"
                  disabled={!renameProjectName.trim()}
                >
                  Save Changes
                </button>

                <button
                  type="button"
                  className="create-project-cancel-btn"
                  onClick={() => setRenamingProject(null)}
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: IMAGE PREVIEW */}
        {previewItem && (
          <div className="modal-backdrop" onClick={() => setPreviewItem(null)}>
            <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
              <div className="preview-modal-header">
                <strong>{previewItem.name}</strong>
                <button onClick={() => setPreviewItem(null)}><X size={18} /></button>
              </div>
              <div className="preview-modal-body">
                <img src={previewItem.preview} alt={previewItem.name} />
              </div>
              <div className="preview-modal-footer">
                <span>{previewItem.sizeFormatted} · {previewItem.date}</span>
                <button className="choose-files-btn" onClick={() => { handleSendToChat(previewItem); setPreviewItem(null); }}>
                  Send to AI Chat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.json,.py,.js,.jsx,.ts,.tsx"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

      </div>
    </div>
  );
}
