// Library Service for Zuhali AI - Real User Files, Media & Projects Storage

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
    if (saved) {
      const parsed = JSON.parse(saved);
      // Cleanly filter out any old demo items
      return parsed.filter((f) => !['file_1', 'file_2', 'file_3', 'file_4', 'file_5'].includes(f.id));
    }
  } catch (e) {}
  return [];
};

export const saveLibraryFiles = (userKey = 'guest', files) => {
  try {
    localStorage.setItem(`zuhali_library_files_${userKey}`, JSON.stringify(files));
  } catch (e) {}
};

export const getLibraryProjects = (userKey = 'guest') => {
  try {
    const saved = localStorage.getItem(`zuhali_library_projects_${userKey}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Cleanly filter out any old demo items
      return parsed.filter((p) => !['proj_1', 'proj_2', 'proj_3', 'proj_4'].includes(p.id));
    }
  } catch (e) {}
  return [];
};

export const saveLibraryProjects = (userKey = 'guest', projects) => {
  try {
    localStorage.setItem(`zuhali_library_projects_${userKey}`, JSON.stringify(projects));
  } catch (e) {}
};
