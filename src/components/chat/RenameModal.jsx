import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';

export default function RenameModal() {
  const { activeRenameModal, setActiveRenameModal, renameChat } = useChat();
  const [val, setVal] = useState(activeRenameModal?.currentTitle || '');

  if (!activeRenameModal) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (val.trim()) {
      renameChat(activeRenameModal.convId, val.trim());
    }
    setActiveRenameModal(null);
  };

  return (
    <div className="modal-backdrop" onClick={() => setActiveRenameModal(null)}>
      <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Rename chat</h2>
        <form onSubmit={handleSave}>
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
            placeholder="Enter chat name"
          />
          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => setActiveRenameModal(null)}
            >
              Cancel
            </button>
            <button type="submit" className="save-button">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
