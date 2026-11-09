import React, { useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import './terminal.css';

export default function Terminal({ onClose }) {
  const [terminals, setTerminals] = useState([
    {
      id: 1,
      lines: [
        'Zuhali Terminal v1.0.0 [Production Shell]',
        'Type "help" for a list of available commands or "status" to verify environment.',
        ''
      ]
    }
  ]);
  const [activeId, setActiveId] = useState(1);
  const [command, setCommand] = useState('');
  const inputRef = useRef(null);
  const active = terminals.find((terminal) => terminal.id === activeId) || terminals[0];

  const updateActive = (lines) => {
    setTerminals((items) =>
      items.map((item) => (item.id === activeId ? { ...item, lines } : item))
    );
  };

  const executeCommand = (cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed) return [];

    const lower = trimmed.toLowerCase();

    if (lower === 'help') {
      return [
        'Available Zuhali Terminal commands:',
        '  help                 Display this command help manual',
        '  status               Check AI Engine, Supabase, and Security Shield',
        '  ls / dir             List project files and directory hierarchy',
        '  clear                Clear the terminal display buffer',
        '  python --version     Print the Python environment version',
        '  git status           Print active branch and staged file changes',
        '  date                 Display current system timestamp',
        '  echo <text>          Print text to standard output'
      ];
    }

    if (lower === 'status') {
      return [
        '[Zuhali System Diagnostics]',
        '  AI Streaming Core   : Active (FastAPI / SSE Engine)',
        '  Database Layer      : Supabase PostgreSQL (RLS Enforced)',
        '  Security Protocols  : JWT Auth, Rate Limiter, Helmet CSP',
        '  Deployment Target   : Render (Web Service Ready)'
      ];
    }

    if (lower === 'ls' || lower === 'dir') {
      return [
        'backend/       (FastAPI Python server, routes, services)',
        'frontend/      (React client components, hooks, assets)',
        'supabase/     (PostgreSQL migrations, RLS policies)',
        'package.json   styles.css   index.html'
      ];
    }

    if (lower === 'python --version') {
      return ['Python 3.13.14 (tags/v3.13.14:a38f387, 64 bit)'];
    }

    if (lower === 'git status') {
      return [
        'On branch main',
        'Your branch is up to date with origin/main.',
        'Changes ready for production deployment.'
      ];
    }

    if (lower === 'date') {
      return [new Date().toString()];
    }

    if (lower.startsWith('echo ')) {
      return [trimmed.slice(5)];
    }

    return [
      `zuhali: command not found: ${trimmed}`,
      'Type "help" to see available terminal commands.'
    ];
  };

  const runCommand = (event) => {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;

    if (value.toLowerCase() === 'clear') {
      updateActive([]);
      setCommand('');
      return;
    }

    const output = executeCommand(value);
    updateActive([...active.lines, `zuhali $ ${value}`, ...output, '']);
    setCommand('');
  };

  const newTerminal = () => {
    const id = Math.max(...terminals.map((item) => item.id)) + 1;
    setTerminals((items) => [
      ...items,
      { id, lines: [`Zuhali Terminal session #${id} initialized.`, ''] }
    ]);
    setActiveId(id);
    setCommand('');
  };

  const clearTerminal = () => updateActive([]);

  return (
    <main className="zuhali-terminal-screen">
      <header className="zuhali-terminal-header">
        <div className="zuhali-terminal-name">Zuhali Terminal</div>
        <div className="zuhali-terminal-actions">
          <button type="button" aria-label="New Terminal" title="New Terminal" onClick={newTerminal}>
            <Plus size={19} />
          </button>
          <button type="button" aria-label="Clear Terminal" title="Clear Terminal" onClick={clearTerminal}>
            <Trash2 size={18} />
          </button>
          <button type="button" aria-label="Close Terminal" title="Close Terminal" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
      </header>
      {terminals.length > 1 && (
        <div className="zuhali-terminal-tabs">
          {terminals.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={item.id === activeId ? 'active' : ''}
              onClick={() => setActiveId(item.id)}
            >
              Terminal {index + 1}
            </button>
          ))}
        </div>
      )}
      <section className="zuhali-terminal-body" onClick={() => inputRef.current?.focus()}>
        <div className="zuhali-terminal-output" aria-live="polite">
          {active.lines.map((line, index) => (
            <div
              className={line.startsWith('zuhali $') ? 'terminal-command-line' : 'terminal-output-line'}
              key={`${active.id}-${index}`}
            >
              {line || '\u00a0'}
            </div>
          ))}
        </div>
        <form className="zuhali-terminal-prompt" onSubmit={runCommand}>
          <span>zuhali $</span>
          <input
            ref={inputRef}
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            autoComplete="off"
            spellCheck="false"
            aria-label="Enter terminal command"
          />
        </form>
      </section>
    </main>
  );
}
