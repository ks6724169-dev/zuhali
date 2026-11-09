// Library Service for Zuhali AI - Manages Files, Media & Projects per User

const DEFAULT_PROJECTS = [
  {
    id: 'proj_1',
    name: 'Zuhali AI',
    description: 'Next-generation AI Workspace and Models',
    updatedAt: 'Today',
    fileCount: 12,
    files: []
  },
  {
    id: 'proj_2',
    name: 'School ERP',
    description: 'School Management & Student Records System',
    updatedAt: 'Yesterday',
    fileCount: 8,
    files: []
  },
  {
    id: 'proj_3',
    name: 'AI Tally',
    description: 'Automated Accounting & Invoice Scanner',
    updatedAt: '7 Nov',
    fileCount: 5,
    files: []
  },
  {
    id: 'proj_4',
    name: 'Website Design',
    description: 'UI/UX Redesign and Branding Assets',
    updatedAt: '5 Nov',
    fileCount: 3,
    files: []
  }
];

const DEFAULT_FILES = [
  {
    id: 'file_1',
    name: 'Nature.jpg',
    category: 'photo',
    type: 'image/jpeg',
    size: 2.4 * 1024 * 1024,
    sizeFormatted: '2.4 MB',
    date: 'Today · 10:30 AM',
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    preview: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80'
  },
  {
    id: 'file_2',
    name: 'Zuhali Logo.png',
    category: 'photo',
    type: 'image/png',
    size: 1.2 * 1024 * 1024,
    sizeFormatted: '1.2 MB',
    date: 'Today · 09:15 AM',
    timestamp: Date.now() - 1000 * 60 * 60 * 4,
    preview: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80'
  },
  {
    id: 'file_3',
    name: 'School.jpg',
    category: 'photo',
    type: 'image/jpeg',
    size: 3.1 * 1024 * 1024,
    sizeFormatted: '3.1 MB',
    date: 'Yesterday · 05:20 PM',
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    preview: 'https://images.unsplash.com/photo-1562774053-701939374585?w=400&q=80'
  },
  {
    id: 'file_4',
    name: 'Design.png',
    category: 'photo',
    type: 'image/png',
    size: 850 * 1024,
    sizeFormatted: '850 KB',
    date: 'Yesterday · 02:10 PM',
    timestamp: Date.now() - 1000 * 60 * 60 * 27,
    preview: 'https://images.unsplash.com/photo-1581291518655-9523c932deb4?w=400&q=80'
  },
  {
    id: 'file_5',
    name: 'Profile.jpg',
    category: 'photo',
    type: 'image/jpeg',
    size: 1.5 * 1024 * 1024,
    sizeFormatted: '1.5 MB',
    date: '8 Nov · 11:45 AM',
    timestamp: Date.now() - 1000 * 60 * 60 * 48,
    preview: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80'
  }
];

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const getLibraryFiles = (userKey = 'guest') => {
  try {
    const saved = localStorage.getItem(`zuhali_library_files_${userKey}`);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return DEFAULT_FILES;
};

export const saveLibraryFiles = (userKey = 'guest', files) => {
  try {
    localStorage.setItem(`zuhali_library_files_${userKey}`, JSON.stringify(files));
  } catch (e) {}
};

export const getLibraryProjects = (userKey = 'guest') => {
  try {
    const saved = localStorage.getItem(`zuhali_library_projects_${userKey}`);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return DEFAULT_PROJECTS;
};

export const saveLibraryProjects = (userKey = 'guest', projects) => {
  try {
    localStorage.setItem(`zuhali_library_projects_${userKey}`, JSON.stringify(projects));
  } catch (e) {}
};
