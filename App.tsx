
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Team, Match, TournamentConfig, MatchScore, TournamentArchive, Streak, PairStats } from './types';
import { generateSchedule, calculateStats, calculatePlayerRankings, calculateStreaks, calculatePairStats } from './utils/scheduler';
import { generateTournamentAnalysis } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Trophy, Users, Calendar, Activity, Plus, Shield, CheckCircle, Award, User, UserPlus, X, Shuffle, BarChart3, Edit3, Save, Download, Upload, UserCheck, List, Home, Clock, MapPin, FileDown, FileUp, Trash2, Crown, Archive, FolderOpen, TrendingUp, TrendingDown, Flame, Database, Settings } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- COMPONENTS ---

const Header = ({ 
    onGoHome, 
    showHome, 
    logo, 
    onLogoUpload 
}: { 
    onGoHome?: () => void, 
    showHome?: boolean, 
    logo?: string | null, 
    onLogoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void 
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);

  return (
  <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 shadow-lg">
    <div className="max-w-5xl mx-auto flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* LOGO SECTION */}
        <div 
            className="h-14 w-14 bg-white rounded-full p-1 border-2 border-padel-ball flex items-center justify-center overflow-hidden shadow-lg shadow-padel-ball/20 cursor-pointer relative group"
            onClick={() => logoInputRef.current?.click()}
            title="Clicca per caricare il tuo logo"
        >
             <img 
                src={logo || "https://cdn-icons-png.flaticon.com/512/3669/3669896.png"} 
                alt="Sulmona Padel Club Logo" 
                className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Upload size={20} className="text-white"/>
            </div>
            <input 
                type="file" 
                ref={logoInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={onLogoUpload}
            />
        </div>
        <div>
            <h1 className="text-2xl font-bold text-white tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">SULMONA PADEL CLUB</h1>
            <p className="text-[10px] text-padel-court font-bold uppercase tracking-widest">Tournament Manager</p>
        </div>
      </div>
      {showHome && (
        <button 
            onClick={onGoHome}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-slate-700 transition-colors text-xs uppercase font-bold"
        >
            <Home size={16} /> <span className="hidden sm:inline">Home</span>
        </button>
      )}
    </div>
  </header>
  );
};

const SetupScreen = ({ 
  onStart,
  onImport,
  onFullBackup
}: { 
  onStart: (teams: Team[], config: TournamentConfig) => void,
  onImport: (data: any) => void,
  onFullBackup: () => void
}) => {
  // Registry State - Initialize from local storage if available
  const [registryPlayers, setRegistryPlayers] = useState<string[]>(() => {
      const saved = localStorage.getItem('padelRegistryDraft');
      return saved ? JSON.parse(saved) : [];
  });
  const [registryInput, setRegistryInput] = useState('');

  // Persist registry changes
  useEffect(() => {
      localStorage.setItem('padelRegistryDraft', JSON.stringify(registryPlayers));
  }, [registryPlayers]);

  // Team Building State
  const [teamName, setTeamName] = useState('');
  const [selectedForTeam, setSelectedForTeam] = useState<string[]>([]);
  const [selectedCaptain, setSelectedCaptain] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  
  const [config, setConfig] = useState<TournamentConfig>({
    name: 'Torneo Sociale',
    mode: 'DOUBLES', // Default to Doubles for Padel
    doubleRound: true,
    playoffTeams: 4
  });

  const [showArchive, setShowArchive] = useState(false);
  const [archiveList, setArchiveList] = useState<TournamentArchive[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const registryFileInputRef = useRef<HTMLInputElement>(null);

  const isAmericano = config.mode === 'AMERICANO';
  const isSingles = config.mode === 'SINGLES';
  const isTeamMode = !isAmericano && !isSingles;

  // Computed: Set of players already assigned to a team
  const assignedPlayers = useMemo(() => {
    return new Set(teams.flatMap(t => t.players));
  }, [teams]);

  // --- Archive Logic ---
  useEffect(() => {
      if (showArchive) {
          const saved = localStorage.getItem('padelArchive');
          setArchiveList(saved ? JSON.parse(saved) : []);
      }
  }, [showArchive]);

  const loadArchive = (archive: TournamentArchive) => {
      if (window.confirm(`Caricare il torneo "${archive.name}" del ${new Date(archive.date).toLocaleDateString()}?`)) {
          onImport({ config: archive.config, teams: archive.teams, matches: archive.matches });
      }
  };

  const handleDeleteFromArchive = (id: string) => {
      if(window.confirm("Sei sicuro di voler eliminare questo torneo dall'archivio?")) {
          const updated = archiveList.filter(a => a.id !== id);
          localStorage.setItem('padelArchive', JSON.stringify(updated));
          setArchiveList(updated);
      }
  };

  // --- Registry Logic ---
  const addPlayerToRegistry = () => {
      if (!registryInput.trim()) return;
      if (registryPlayers.includes(registryInput.trim())) {
          alert("Giocatore già presente nell'albo.");
          return;
      }
      setRegistryPlayers([...registryPlayers, registryInput.trim()]);
      setRegistryInput('');
  };

  const removePlayerFromRegistry = (player: string) => {
      if (assignedPlayers.has(player)) {
          alert("Impossibile rimuovere: questo giocatore è già in una squadra.");
          return;
      }
      setRegistryPlayers(registryPlayers.filter(p => p !== player));
      setSelectedForTeam(selectedForTeam.filter(p => p !== player));
      if (selectedCaptain === player) setSelectedCaptain(null);
  };
  
  const clearRegistry = () => {
      if(registryPlayers.some(p => assignedPlayers.has(p))) {
          alert("Non puoi svuotare l'albo perché alcuni giocatori sono già in squadra. Rimuovi prima le squadre.");
          return;
      }
      if(confirm("Sei sicuro di voler cancellare tutti i nomi dall'albo?")) {
          setRegistryPlayers([]);
      }
  };

  const handleRenamePlayer = (oldName: string) => {
      const newName = prompt("Inserisci il nuovo nome:", oldName);
      if (newName && newName.trim() !== "" && newName !== oldName) {
           if (registryPlayers.includes(newName)) {
               alert("Nome già esistente.");
               return;
           }
           // Update Registry
           setRegistryPlayers(registryPlayers.map(p => p === oldName ? newName : p));
           // Update Selected
           if (selectedForTeam.includes(oldName)) {
               setSelectedForTeam(selectedForTeam.map(p => p === oldName ? newName : p));
           }
           if (selectedCaptain === oldName) setSelectedCaptain(newName);
      }
  };

  const handleExportRegistry = () => {
      if (registryPlayers.length === 0) {
          alert("Nessun giocatore da esportare.");
          return;
      }
      const data = { players: registryPlayers };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'padel-players-list.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportRegistry = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const res = JSON.parse(ev.target?.result as string);
              const newPlayers = Array.isArray(res) ? res : (res.players || []);
              
              if(Array.isArray(newPlayers)) {
                   const unique = Array.from(new Set([...registryPlayers, ...newPlayers.filter(p => typeof p === 'string')]));
                   setRegistryPlayers(unique);
                   alert(`${unique.length - registryPlayers.length} nuovi giocatori importati.`);
              } else {
                  alert("Formato file non valido.");
              }
          } catch(err) { alert("Errore lettura file."); }
      }
      reader.readAsText(file);
      if(registryFileInputRef.current) registryFileInputRef.current.value = '';
  };

  // --- Team Logic ---
  const togglePlayerSelection = (player: string) => {
      if (assignedPlayers.has(player)) return; 

      if (selectedForTeam.includes(player)) {
          setSelectedForTeam(selectedForTeam.filter(p => p !== player));
          if (selectedCaptain === player) setSelectedCaptain(null);
      } else {
          setSelectedForTeam([...selectedForTeam, player]);
      }
  };

  const handleAddTeam = () => {
    const minPlayers = isTeamMode ? 2 : 1;
    
    if (selectedForTeam.length < minPlayers) {
        alert(`Seleziona almeno ${minPlayers} giocatori per creare una squadra.`);
        return;
    }

    let finalName = teamName.trim();
    if (!finalName) {
        finalName = selectedForTeam.join(' / ');
    }

    // Auto-select first player as captain if none selected in team mode
    let finalCaptain = selectedCaptain;
    if (isTeamMode && !finalCaptain && selectedForTeam.length > 0) {
        finalCaptain = selectedForTeam[0];
    }

    const newTeam: Team = {
        id: crypto.randomUUID(),
        name: finalName,
        players: [...selectedForTeam],
        captain: finalCaptain || undefined
    };

    setTeams([...teams, newTeam]);
    setTeamName('');
    setSelectedForTeam([]);
    setSelectedCaptain(null);
  };

  const handleAddAllAsIndividuals = () => {
      const available = registryPlayers.filter(p => !assignedPlayers.has(p));
      const newTeams = available.map(p => ({
          id: crypto.randomUUID(),
          name: p,
          players: [p]
      }));
      setTeams([...teams, ...newTeams]);
  };

  const removeTeam = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = event.target?.result as string;
              const data = JSON.parse(json);
              onImport(data);
          } catch (err) {
              alert("Errore durante la lettura del file. Assicurati che sia un JSON valido.");
          }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 animate-fade-in">
      <div className="bg-slate-800 rounded-xl p-6 md:p-8 shadow-2xl border border-slate-700">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-700 pb-6">
            <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                <Settings className="text-padel-court" /> Configurazione Torneo
                </h2>
                <p className="text-slate-400 text-sm mt-1">Registra i giocatori e forma le squadre</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                 <div className="flex-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">Nome Evento</label>
                    <input 
                    type="text" 
                    value={config.name}
                    onChange={e => setConfig({...config, name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-padel-court"
                    />
                </div>
            </div>
        </div>
        
        {/* Archive Modal */}
        {showArchive && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                         <h3 className="text-xl font-bold text-white flex items-center gap-2"><Archive size={20}/> Archivio Storico</h3>
                         <button onClick={() => setShowArchive(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                    </div>
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                        {archiveList.length === 0 ? (
                            <p className="text-slate-500 italic text-center py-4">Nessun torneo archiviato.</p>
                        ) : (
                            archiveList.slice().reverse().map(arch => (
                                <div key={arch.id} className="bg-slate-900 p-3 rounded flex justify-between items-center hover:bg-slate-950 transition-colors group">
                                    <div className="cursor-pointer flex-1" onClick={() => { loadArchive(arch); setShowArchive(false); }}>
                                        <p className="font-bold text-white">{arch.name}</p>
                                        <p className="text-xs text-slate-500">{new Date(arch.date).toLocaleString()} • {arch.teams.length} Squadre</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { loadArchive(arch); setShowArchive(false); }} className="text-padel-court hover:text-blue-400 p-1" title="Carica">
                                            <FolderOpen size={18} />
                                        </button>
                                        <button onClick={() => handleDeleteFromArchive(arch.id)} className="text-slate-600 hover:text-red-400 p-1" title="Elimina">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
        
        {/* Game Mode Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
             <div 
                onClick={() => { setConfig({...config, mode: 'DOUBLES'}); setTeams([]); setSelectedForTeam([]); }}
                className={`cursor-pointer p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${config.mode === 'DOUBLES' ? 'bg-padel-court/10 border-padel-court' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
             >
                 <Users size={28} className={config.mode === 'DOUBLES' ? 'text-padel-court' : 'text-slate-500'} />
                 <span className={`font-bold text-center ${config.mode === 'DOUBLES' ? 'text-white' : 'text-slate-500'}`}>Doppio (2 vs 2)</span>
             </div>
             <div 
                onClick={() => { setConfig({...config, mode: 'AMERICANO'}); setTeams([]); setSelectedForTeam([]); }}
                className={`cursor-pointer p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${config.mode === 'AMERICANO' ? 'bg-padel-court/10 border-padel-court' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
             >
                 <Shuffle size={28} className={config.mode === 'AMERICANO' ? 'text-padel-court' : 'text-slate-500'} />
                 <span className={`font-bold text-center ${config.mode === 'AMERICANO' ? 'text-white' : 'text-slate-500'}`}>Americano (Tutti vs Tutti)</span>
             </div>
             <div 
                onClick={() => { setConfig({...config, mode: 'SINGLES'}); setTeams([]); setSelectedForTeam([]); }}
                className={`cursor-pointer p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${config.mode === 'SINGLES' ? 'bg-padel-court/10 border-padel-court' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
             >
                 <User size={28} className={config.mode === 'SINGLES' ? 'text-padel-court' : 'text-slate-500'} />
                 <span className={`font-bold text-center ${config.mode === 'SINGLES' ? 'text-white' : 'text-slate-500'}`}>Singolo (1 vs 1)</span>
             </div>
        </div>

        {/* Main Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* COLUMN 1: Player Registry */}
            <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 h-full">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-4">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <List size={18} className="text-padel-ball"/> Albo Giocatori
                        </h3>
                        <div className="flex gap-1">
                             <input 
                                type="file" 
                                ref={registryFileInputRef}
                                onChange={handleImportRegistry}
                                accept=".json,application/json"
                                className="hidden" 
                            />
                            <button 
                                onClick={() => registryFileInputRef.current?.click()} 
                                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                title="Importa Lista"
                            >
                                <FileUp size={16}/>
                            </button>
                            <button 
                                onClick={handleExportRegistry} 
                                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                title="Esporta Lista"
                            >
                                <FileDown size={16}/>
                            </button>
                             <button 
                                onClick={clearRegistry} 
                                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400"
                                title="Svuota Lista"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text"
                            placeholder="Nome giocatore..."
                            value={registryInput}
                            onChange={e => setRegistryInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addPlayerToRegistry()}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-padel-court outline-none"
                        />
                        <button 
                            onClick={addPlayerToRegistry}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-3 rounded-lg transition-colors border border-slate-600"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    <div className="overflow-y-auto max-h-[400px] space-y-2 pr-1 custom-scrollbar">
                        {registryPlayers.length === 0 ? (
                            <div className="text-center text-slate-600 italic text-sm py-4">
                                Aggiungi qui i nomi di tutti i partecipanti.
                            </div>
                        ) : (
                            registryPlayers.map((player, idx) => {
                                const isAssigned = assignedPlayers.has(player);
                                return (
                                    <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-sm border ${isAssigned ? 'bg-green-900/10 border-green-900/30 text-green-500' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => handleRenamePlayer(player)}>
                                            <span className="text-slate-600 text-xs w-4">{idx + 1}.</span>
                                            <User size={14} />
                                            <span className={isAssigned ? 'line-through opacity-70' : ''}>{player}</span>
                                            <Edit3 size={10} className="opacity-0 group-hover:opacity-100 text-slate-500" />
                                        </div>
                                        {isAssigned ? (
                                            <CheckCircle size={14} className="text-green-500" />
                                        ) : (
                                            <button onClick={() => removePlayerFromRegistry(player)} className="text-slate-500 hover:text-red-400">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                     <div className="mt-2 text-right">
                         <span className="text-xs text-slate-500">Totale: {registryPlayers.length}</span>
                     </div>
                </div>
            </div>

            {/* COLUMN 2: Team Builder */}
            <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                        <UserPlus size={18} className="text-padel-court"/> 
                        {isTeamMode ? "Composizione Squadre" : "Lista Partecipanti"}
                    </h3>

                    {/* Builder Area */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 mb-4">
                        {isTeamMode && (
                            <div className="mb-4">
                                <label className="text-slate-400 text-xs uppercase font-bold mb-1 block">Nome Squadra (Opzionale)</label>
                                <input 
                                    type="text"
                                    placeholder={selectedForTeam.length > 0 ? selectedForTeam.join(' & ') : "Es. The Avengers"}
                                    value={teamName}
                                    onChange={e => setTeamName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-padel-court outline-none"
                                />
                            </div>
                        )}

                        <div className="mb-2">
                            <label className="text-slate-400 text-xs uppercase font-bold mb-2 block">
                                Seleziona Giocatori dall'Albo ({selectedForTeam.length})
                            </label>
                            {registryPlayers.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">L'albo è vuoto.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {registryPlayers.filter(p => !assignedPlayers.has(p)).length === 0 && (
                                        <p className="text-sm text-green-500 italic flex items-center gap-1"><CheckCircle size={14}/> Tutti i giocatori sono assegnati!</p>
                                    )}
                                    {registryPlayers.map(player => {
                                        const isAssigned = assignedPlayers.has(player);
                                        if (isAssigned) return null; 
                                        const isSelected = selectedForTeam.includes(player);
                                        const isCaptain = selectedCaptain === player;

                                        return (
                                            <div 
                                                key={player}
                                                className={`text-sm rounded-full border transition-all flex items-center gap-0 overflow-hidden ${isSelected ? 'bg-padel-court text-white border-padel-court shadow-lg shadow-blue-500/20' : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-400'}`}
                                            >
                                                <button 
                                                    onClick={() => togglePlayerSelection(player)}
                                                    className="px-3 py-1.5 flex items-center gap-2"
                                                >
                                                    {isSelected ? <CheckCircle size={14}/> : <Plus size={14}/>}
                                                    {player}
                                                </button>
                                                {isSelected && isTeamMode && (
                                                    <button 
                                                        onClick={() => setSelectedCaptain(isCaptain ? null : player)}
                                                        className={`px-2 py-1.5 border-l ${isCaptain ? 'bg-yellow-400 text-yellow-900 border-yellow-500' : 'border-blue-400 hover:bg-blue-600'}`}
                                                        title="Imposta Capitano"
                                                    >
                                                        <Crown size={12} className={isCaptain ? 'fill-current' : ''} />
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-4 flex gap-2">
                            {isTeamMode ? (
                                <button 
                                    onClick={handleAddTeam}
                                    disabled={selectedForTeam.length < 2}
                                    className="bg-padel-court hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    <Plus size={16} /> Crea Squadra
                                </button>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-2 w-full">
                                    <button 
                                        onClick={handleAddTeam}
                                        disabled={selectedForTeam.length < 1}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm border border-slate-600 disabled:opacity-50"
                                    >
                                        <Plus size={16} /> Aggiungi Selezionati
                                    </button>
                                    <button 
                                        onClick={handleAddAllAsIndividuals}
                                        disabled={registryPlayers.filter(p => !assignedPlayers.has(p)).length === 0}
                                        className="flex-1 bg-padel-court hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <UserCheck size={16} /> Aggiungi Tutti i Rimanenti
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Created Teams List */}
                    <div>
                        <h4 className="text-slate-400 text-xs uppercase font-bold mb-3 flex items-center gap-2">
                            Iscritti al Torneo 
                            <span className="bg-slate-700 text-slate-200 px-2 rounded-full">{teams.length}</span>
                        </h4>
                        
                        {teams.length === 0 ? (
                            <div className="text-slate-600 italic text-sm text-center py-4 bg-slate-900/30 rounded-lg">
                                Nessun partecipante aggiunto.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                {teams.map(t => (
                                    <div key={t.id} className="bg-slate-700 text-white p-3 rounded-lg border border-slate-600 flex items-center justify-between shadow-sm group">
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-bold text-sm truncate">{t.name}</span>
                                            {isTeamMode && (
                                                <div className="text-[10px] text-slate-400 truncate flex flex-wrap gap-1 mt-1">
                                                    {t.players.map(p => (
                                                        <span key={p} className={`flex items-center gap-0.5 ${p === t.captain ? 'text-yellow-400 font-bold' : ''}`}>
                                                            {p} {p === t.captain && <Crown size={8} className="fill-current"/>}
                                                            {p !== t.players[t.players.length-1] && <span className="text-slate-600 font-normal">, </span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => removeTeam(t.id)} className="text-slate-400 hover:text-red-400 bg-slate-800 rounded-full p-1.5 transition-colors ml-2">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Footer Configuration */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-700 pt-6">
             {!isAmericano && (
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => setConfig({...config, doubleRound: !config.doubleRound})}>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-medium">Andata e Ritorno</span>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${config.doubleRound ? 'bg-padel-court border-padel-court' : 'border-slate-500'}`}>
                            {config.doubleRound && <CheckCircle size={16} className="text-white" />}
                        </div>
                    </div>
                </div>
             )}
             
             <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-300 font-medium">Accesso Playoff</label>
                    <Shield size={16} className="text-slate-500"/>
                </div>
                <select 
                  value={config.playoffTeams}
                  onChange={e => setConfig({...config, playoffTeams: Number(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-600 rounded text-white p-2 text-sm focus:ring-1 focus:ring-padel-court"
                  disabled={isAmericano} 
                >
                  <option value={0}>Nessuno (Solo Girone)</option>
                  {!isAmericano && <option value={2}>Top 2 (Finale Diretta)</option>}
                  {!isAmericano && <option value={4}>Top 4 (Semifinali)</option>}
                  {!isAmericano && <option value={-1}>Tutti i partecipanti</option>}
                </select>
                {isAmericano && <p className="text-xs text-slate-500 mt-1">Non disponibile in Americano.</p>}
             </div>
        </div>

        {/* DATA MANAGEMENT SECTION */}
        <div className="mt-6 bg-slate-900/80 p-4 rounded-lg border border-slate-700">
            <h4 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
                <Database size={16} className="text-padel-court"/> Gestione Dati e Backup
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                 <button 
                    onClick={onFullBackup}
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded border border-slate-600 transition-colors text-xs"
                >
                    <Download size={14} /> Scarica Backup Completo Sistema
                </button>
                <div className="relative">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded border border-slate-600 transition-colors text-xs"
                    >
                        <Upload size={14} /> Ripristina da File
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json,application/json" 
                        className="hidden" 
                    />
                </div>
                 <button 
                    onClick={() => setShowArchive(true)}
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded border border-slate-600 transition-colors text-xs"
                >
                    <Archive size={14} /> Gestisci Archivio ({archiveList.length})
                </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center">
                Il Backup Completo salva: Torneo Attuale, Archivio Storico, Albo Giocatori e Logo.
            </p>
        </div>

        <button 
            disabled={teams.length < (isAmericano ? 4 : 2)}
            onClick={() => onStart(teams, config)}
            className="w-full bg-padel-ball hover:bg-yellow-400 text-slate-900 font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 text-lg flex items-center justify-center gap-2"
        >
            <Trophy size={20} />
            Inizia Torneo {isAmericano && teams.length < 4 && "(Min 4 giocatori)"}
        </button>
      </div>
    </div>
  );
};

interface MatchCardProps {
  match: Match;
  teams: Team[];
  onUpdate: (m: Match) => void;
  mode: string;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, teams, onUpdate, mode }) => {
  const isAmericano = mode === 'AMERICANO';
  const isSingles = mode === 'SINGLES';

  // State local vars
  const [score, setScore] = useState<MatchScore>(match.score || {
    set1: { a: 0, b: 0 },
    set2: { a: 0, b: 0 },
    set3: { a: 0, b: 0 }
  });
  
  // Selection state for team players
  const [selectedPlayersA, setSelectedPlayersA] = useState<string[]>(match.playersAIds || []);
  const [selectedPlayersB, setSelectedPlayersB] = useState<string[]>(match.playersBIds || []);

  // Additional match info state
  const [matchDate, setMatchDate] = useState<string>(match.date || '');
  const [matchCourt, setMatchCourt] = useState<string>(match.court || '');

  const [isEditing, setIsEditing] = useState(!match.played);

  // Teams references
  const teamA = teams.find(t => t.id === match.teamAId);
  const teamB = teams.find(t => t.id === match.teamBId);

  // Auto-select players if single/doubles exact count match
  useEffect(() => {
    if (!match.played && !isAmericano) {
        if (teamA && teamA.players.length <= (isSingles ? 1 : 2) && selectedPlayersA.length === 0) {
            setSelectedPlayersA(teamA.players);
        }
        if (teamB && teamB.players.length <= (isSingles ? 1 : 2) && selectedPlayersB.length === 0) {
            setSelectedPlayersB(teamB.players);
        }
    }
  }, [teamA, teamB, match.played, isAmericano, isSingles]);

  // Handle player selection toggle
  const togglePlayerA = (player: string) => {
      if (selectedPlayersA.includes(player)) {
          setSelectedPlayersA(selectedPlayersA.filter(p => p !== player));
      } else {
          // Limit selection based on mode
          const limit = isSingles ? 1 : 2;
          if (selectedPlayersA.length < limit) {
              setSelectedPlayersA([...selectedPlayersA, player]);
          }
      }
  };

  const togglePlayerB = (player: string) => {
      if (selectedPlayersB.includes(player)) {
          setSelectedPlayersB(selectedPlayersB.filter(p => p !== player));
      } else {
          const limit = isSingles ? 1 : 2;
          if (selectedPlayersB.length < limit) {
              setSelectedPlayersB([...selectedPlayersB, player]);
          }
      }
  };

  const handleSave = () => {
    // Validation
    const reqPlayers = isSingles ? 1 : 2;
    if (!isAmericano && teamA && teamA.id !== 'BYE' && teamB && teamB.id !== 'BYE') {
        if (selectedPlayersA.length !== reqPlayers || selectedPlayersB.length !== reqPlayers) {
            alert(`Seleziona esattamente ${reqPlayers} giocatore/i per squadra.`);
            return;
        }
    }

    // Simple winner logic for sets
    let setsA = 0;
    let setsB = 0;
    if (score.set1.a > score.set1.b) setsA++; else if (score.set1.b > score.set1.a) setsB++;
    if (score.set2.a > score.set2.b) setsA++; else if (score.set2.b > score.set2.a) setsB++;
    if (score.set3 && (score.set3.a > score.set3.b)) setsA++; else if (score.set3 && score.set3.b > score.set3.a) setsB++;

    const winnerId = !isAmericano ? (setsA > setsB ? match.teamAId : (setsB > setsA ? match.teamBId : undefined)) : undefined;

    onUpdate({
      ...match,
      score,
      played: true,
      winnerId,
      playersAIds: isAmericano ? match.playersAIds : selectedPlayersA,
      playersBIds: isAmericano ? match.playersBIds : selectedPlayersB,
      date: matchDate,
      court: matchCourt
    });
    setIsEditing(false);
  };

  const updateSet = (set: 'set1' | 'set2' | 'set3', team: 'a' | 'b', val: string) => {
    const num = parseInt(val) || 0;
    setScore(prev => ({
        ...prev,
        [set]: {
            ...prev[set]!,
            [team]: num
        }
    }));
  };

  // Helper to resolve display names
  const getSideInfo = (teamId: string, playerIds?: string[], currentTeam?: Team) => {
      if (isAmericano && playerIds) {
          // Resolve individual names
          const names = playerIds.map(pid => teams.find(t => t.id === pid)?.name || 'Unknown');
          return { name: names.join(' & '), isWinner: false, displayPlayers: names, captain: null };
      } else {
          const t = currentTeam || teams.find(t => t.id === teamId);
          // Use saved playerIds if available, else all players
          const effectivePlayers = playerIds && playerIds.length > 0 ? playerIds : t?.players;
          return { name: t?.name || 'Riposo', displayPlayers: effectivePlayers, isWinner: match.winnerId === teamId, allPlayers: t?.players, captain: t?.captain };
      }
  };

  const sideA = getSideInfo(match.teamAId, match.playersAIds, teamA);
  const sideB = getSideInfo(match.teamBId, match.playersBIds, teamB);
  
  // Americano winner check logic
  const getAmericanoWinner = () => {
      if (!match.score) return null;
      let setsA = 0, setsB = 0;
      if (match.score.set1.a > match.score.set1.b) setsA++; else if(match.score.set1.b > match.score.set1.a) setsB++;
      if (match.score.set2.a > match.score.set2.b) setsA++; else if(match.score.set2.b > match.score.set2.a) setsB++;
      if (setsA > setsB) return 'A';
      if (setsB > setsA) return 'B';
      return null;
  }
  const americanoWinner = getAmericanoWinner();

  if (!sideA.name || !sideB.name) return null;

  return (
    <div className={`bg-slate-800 rounded-lg p-4 mb-4 border-l-4 ${match.played ? 'border-green-500' : 'border-slate-600'} shadow-md transition-all hover:bg-slate-800/80`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                {match.isPlayoff ? <Award size={14} className="text-padel-ball"/> : <Calendar size={14} />}
                {match.isPlayoff ? match.playoffLabel : `Round ${match.round}`}
            </span>
            {/* Display Date and Court if set */}
            {!isEditing && (match.date || match.court) && (
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    {match.date && <span className="flex items-center gap-1"><Clock size={10}/> {new Date(match.date).toLocaleString()}</span>}
                    {match.court && <span className="flex items-center gap-1"><MapPin size={10}/> {match.court}</span>}
                </div>
            )}
        </div>
        {match.played && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-xs text-padel-court hover:underline">
                <Edit3 size={12}/> Modifica
            </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Team A */}
        <div className={`flex-1 text-right flex flex-col items-end`}>
            <span className={`font-bold leading-tight ${(sideA.isWinner || (isAmericano && americanoWinner === 'A')) ? 'text-green-400' : 'text-white'}`}>{sideA.name}</span>
            
            {/* Player Selection UI for Team A */}
            {isEditing && !isAmericano && teamA && teamA.id !== 'BYE' && teamA.players.length > (isSingles ? 1 : 2) ? (
                 <div className="flex flex-wrap gap-1 justify-end mt-1 max-w-[150px]">
                    {teamA.players.map(p => (
                        <button 
                            key={p} 
                            onClick={() => togglePlayerA(p)}
                            className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${selectedPlayersA.includes(p) ? 'bg-padel-court text-white border-padel-court' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
                        >
                            {p} {p === sideA.captain && <Crown size={8} className="fill-current text-yellow-400" />}
                        </button>
                    ))}
                 </div>
            ) : (
                sideA.displayPlayers && sideA.displayPlayers.length > 0 && (
                    <span className="text-[10px] text-slate-500 flex gap-1 items-center justify-end">
                        {sideA.displayPlayers.map((p, i) => (
                            <React.Fragment key={p}>
                                <span className="flex items-center gap-0.5">
                                    {p} {p === sideA.captain && <Crown size={8} className="fill-current text-yellow-400" />}
                                </span>
                                {i < sideA.displayPlayers!.length - 1 && <span> - </span>}
                            </React.Fragment>
                        ))}
                    </span>
                )
            )}
        </div>

        {/* Scores & Editing Panel */}
        <div className="flex gap-2">
            {isEditing ? (
                <div className="flex flex-col items-center bg-slate-900/50 p-2 rounded border border-slate-700">
                    {/* Date/Court Inputs */}
                    <div className="flex gap-2 mb-2 w-full">
                        <input 
                            type="datetime-local" 
                            value={matchDate} 
                            onChange={(e) => setMatchDate(e.target.value)}
                            className="flex-1 bg-slate-800 text-[10px] text-white p-1 rounded border border-slate-600 focus:outline-none focus:border-padel-court min-w-0"
                        />
                         <select 
                            value={matchCourt} 
                            onChange={(e) => setMatchCourt(e.target.value)}
                            className="w-28 bg-slate-800 text-[10px] text-white p-1 rounded border border-slate-600 focus:outline-none focus:border-padel-court"
                        >
                            <option value="">Campo...</option>
                            <option value="OLIMPIONICA">OLIMPIONICA</option>
                            <option value="M&T">M&T</option>
                        </select>
                    </div>

                    <div className="flex gap-2 mb-2">
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-[10px] text-slate-500 uppercase">S1</span>
                            <div className="flex gap-1">
                                <input className="w-8 h-8 text-center bg-slate-900 text-white rounded border border-slate-600 focus:border-padel-court focus:outline-none" type="number" value={score.set1.a} onChange={e => updateSet('set1', 'a', e.target.value)} />
                                <input className="w-8 h-8 text-center bg-slate-900 text-white rounded border border-slate-600 focus:border-padel-court focus:outline-none" type="number" value={score.set1.b} onChange={e => updateSet('set1', 'b', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-[10px] text-slate-500 uppercase">S2</span>
                            <div className="flex gap-1">
                                <input className="w-8 h-8 text-center bg-slate-900 text-white rounded border border-slate-600 focus:border-padel-court focus:outline-none" type="number" value={score.set2.a} onChange={e => updateSet('set2', 'a', e.target.value)} />
                                <input className="w-8 h-8 text-center bg-slate-900 text-white rounded border border-slate-600 focus:border-padel-court focus:outline-none" type="number" value={score.set2.b} onChange={e => updateSet('set2', 'b', e.target.value)} />
                            </div>
                        </div>
                         <div className="flex flex-col gap-1 items-center">
                            <span className="text-[10px] text-slate-500 uppercase">S3</span>
                            <div className="flex gap-1">
                                <input className="w-8 h-8 text-center bg-slate-900 text-white rounded border border-slate-600 focus:border-padel-court focus:outline-none" type="number" value={score.set3?.a || 0} onChange={e => updateSet('set3', 'a', e.target.value)} />
                                <input className="w-8 h-8 text-center bg-slate-900 text-white rounded border border-slate-600 focus:border-padel-court focus:outline-none" type="number" value={score.set3?.b || 0} onChange={e => updateSet('set3', 'b', e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white px-6 py-1 rounded text-xs font-bold w-full flex items-center justify-center gap-1 shadow-sm">
                        <Save size={12} /> Salva Risultato
                    </button>
                </div>
            ) : (
                <div className="flex gap-3 text-lg font-mono font-bold text-white bg-slate-900 px-3 py-2 rounded items-center shadow-inner border border-slate-800">
                    <span>{match.score?.set1.a}-{match.score?.set1.b}</span>
                    <span className="text-slate-700 text-sm">|</span>
                    <span>{match.score?.set2.a}-{match.score?.set2.b}</span>
                    {(match.score?.set3 && (match.score.set3.a > 0 || match.score.set3.b > 0)) && (
                        <>
                         <span className="text-slate-700 text-sm">|</span>
                         <span>{match.score?.set3.a}-{match.score?.set3.b}</span>
                        </>
                    )}
                </div>
            )}
        </div>

        {/* Team B */}
        <div className={`flex-1 text-left flex flex-col`}>
            <span className={`font-bold leading-tight ${(sideB.isWinner || (isAmericano && americanoWinner === 'B')) ? 'text-green-400' : 'text-white'}`}>{sideB.name}</span>
            
            {/* Player Selection UI for Team B */}
            {isEditing && !isAmericano && teamB && teamB.id !== 'BYE' && teamB.players.length > (isSingles ? 1 : 2) ? (
                 <div className="flex flex-wrap gap-1 justify-start mt-1 max-w-[150px]">
                    {teamB.players.map(p => (
                        <button 
                            key={p} 
                            onClick={() => togglePlayerB(p)}
                            className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${selectedPlayersB.includes(p) ? 'bg-padel-court text-white border-padel-court' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
                        >
                            {p} {p === sideB.captain && <Crown size={8} className="fill-current text-yellow-400" />}
                        </button>
                    ))}
                 </div>
            ) : (
                sideB.displayPlayers && sideB.displayPlayers.length > 0 && (
                     <span className="text-[10px] text-slate-500 flex gap-1 items-center justify-start">
                        {sideB.displayPlayers.map((p, i) => (
                            <React.Fragment key={p}>
                                <span className="flex items-center gap-0.5">
                                    {p} {p === sideB.captain && <Crown size={8} className="fill-current text-yellow-400" />}
                                </span>
                                {i < sideB.displayPlayers!.length - 1 && <span> - </span>}
                            </React.Fragment>
                        ))}
                    </span>
                )
            )}
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ 
    teams, 
    matches, 
    config, 
    onUpdateMatch,
    onReset,
    onExport,
    onImport,
    onFullBackup
}: { 
    teams: Team[], 
    matches: Match[], 
    config: TournamentConfig, 
    onUpdateMatch: (m: Match) => void,
    onReset: () => void,
    onExport: () => void,
    onImport: (data: any) => void,
    onFullBackup: () => void
}) => {
    const [activeTab, setActiveTab] = useState<'standings' | 'players' | 'matches' | 'analysis' | 'pro'>('standings');
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [loadingAi, setLoadingAi] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter regular season matches
    const regularMatches = useMemo(() => matches.filter(m => !m.isPlayoff), [matches]);
    const playoffMatches = useMemo(() => matches.filter(m => m.isPlayoff), [matches]);

    const stats = useMemo(() => calculateStats(teams, regularMatches, config.mode), [teams, regularMatches, config.mode]);
    const playerStats = useMemo(() => calculatePlayerRankings(teams, regularMatches), [teams, regularMatches]);
    const streaks = useMemo(() => calculateStreaks(teams, regularMatches), [teams, regularMatches]);
    const pairStats = useMemo(() => calculatePairStats(teams, regularMatches), [teams, regularMatches]);
    
    const handleRenamePlayer = (oldName: string) => {
        const newName = prompt("Inserisci il nuovo nome:", oldName);
        if (newName && newName.trim() !== "" && newName !== oldName) {
            alert("Per rinominare un giocatore, vai nella sezione Configurazione (Home) -> Albo Giocatori.");
        }
    };

    const handleGenerateAnalysis = async () => {
        setLoadingAi(true);
        const text = await generateTournamentAnalysis(teams, stats, matches);
        setAiAnalysis(text);
        setLoadingAi(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = event.target?.result as string;
                const data = JSON.parse(json);
                onImport(data);
            } catch (err) {
                alert("Errore file. Assicurati sia un JSON valido.");
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.text("SULMONA PADEL CLUB", 105, 15, { align: "center" });
        doc.setFontSize(12);
        doc.text(`${config.name} - ${new Date().toLocaleDateString()}`, 105, 22, { align: "center" });
        
        let startY = 30;

        // Standings
        if (config.mode !== 'AMERICANO') {
            doc.setFontSize(14);
            doc.text("Classifica Squadre", 14, startY);
            
            const tableData = stats.map((s, i) => {
                const t = teams.find(team => team.id === s.teamId);
                return [
                    i + 1,
                    t?.name || '',
                    s.points,
                    s.played,
                    s.won,
                    s.lost,
                    s.setsWon - s.setsLost,
                    s.gamesWon - s.gamesLost
                ];
            });

            autoTable(doc, {
                startY: startY + 5,
                head: [['Pos', 'Squadra', 'PT', 'G', 'V', 'P', 'Set Diff', 'Game Diff']],
                body: tableData,
            });
            
            // @ts-ignore
            startY = doc.lastAutoTable.finalY + 15;
        }

        // Players Ranking
        doc.setFontSize(14);
        doc.text("Ranking Giocatori", 14, startY);
        const playersData = playerStats.map((p, i) => [
            i + 1,
            p.name,
            `${p.winRate.toFixed(1)}%`,
            p.avgSetDiff.toFixed(2),
            p.avgGameDiff.toFixed(2),
            p.played
        ]);

        autoTable(doc, {
            startY: startY + 5,
            head: [['Pos', 'Giocatore', '% Vitt', 'Set Avg', 'Game Avg', 'Partite']],
            body: playersData,
        });
        
        // @ts-ignore
        startY = doc.lastAutoTable.finalY + 15;

        // Matches
        doc.addPage();
        startY = 20;
        doc.setFontSize(14);
        doc.text("Risultati Partite", 14, startY);
        
        const matchesData = matches.map(m => {
            const tA = teams.find(t => t.id === m.teamAId)?.name || 'Riposo';
            const tB = teams.find(t => t.id === m.teamBId)?.name || 'Riposo';
            const score = m.played && m.score 
                ? `${m.score.set1.a}-${m.score.set1.b} ${m.score.set2.a}-${m.score.set2.b} ${m.score.set3?.a || ''}-${m.score.set3?.b || ''}`
                : 'Da giocare';
            return [
                m.isPlayoff ? m.playoffLabel : `Round ${m.round}`,
                tA,
                tB,
                score
            ];
        });

        autoTable(doc, {
            startY: startY + 5,
            head: [['Turno', 'Squadra A', 'Squadra B', 'Risultato']],
            body: matchesData,
        });

        doc.save("report-torneo.pdf");
    };

    // Color palette for charts
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 pb-20">
            {/* Navigation Tabs */}
            <div className="flex bg-slate-900 p-1 rounded-xl mb-6 shadow-lg border border-slate-800 overflow-x-auto">
                <button onClick={() => setActiveTab('standings')} className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex justify-center gap-2 whitespace-nowrap ${activeTab === 'standings' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                    <Trophy size={18} /> Squadre
                </button>
                 <button onClick={() => setActiveTab('players')} className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex justify-center gap-2 whitespace-nowrap ${activeTab === 'players' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                    <BarChart3 size={18} /> Giocatori
                </button>
                <button onClick={() => setActiveTab('matches')} className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex justify-center gap-2 whitespace-nowrap ${activeTab === 'matches' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                    <Calendar size={18} /> Partite
                </button>
                <button onClick={() => setActiveTab('pro')} className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex justify-center gap-2 whitespace-nowrap ${activeTab === 'pro' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                    <Flame size={18} /> Pro Stats
                </button>
                <button onClick={() => setActiveTab('analysis')} className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex justify-center gap-2 whitespace-nowrap ${activeTab === 'analysis' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                    <Activity size={18} /> Coach AI
                </button>
            </div>

            {/* Standings View (Teams) */}
            {activeTab === 'standings' && (
                <div className="animate-fade-in space-y-6">
                    {config.mode === 'AMERICANO' ? (
                         <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center">
                            <p className="text-slate-400 mb-2">Nella modalità Americano, la classifica è individuale.</p>
                            <button onClick={() => setActiveTab('players')} className="text-padel-court hover:underline font-bold">Vedi Classifica Giocatori</button>
                         </div>
                    ) : (
                    <>
                    <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-900 text-slate-400 uppercase text-xs font-bold tracking-wider">
                                    <tr>
                                        <th className="p-4">Pos</th>
                                        <th className="p-4">Squadra / Giocatori</th>
                                        <th className="p-4 text-center">PT</th>
                                        <th className="p-4 text-center hidden sm:table-cell">G</th>
                                        <th className="p-4 text-center hidden sm:table-cell">V</th>
                                        <th className="p-4 text-center hidden sm:table-cell">P</th>
                                        <th className="p-4 text-center hidden md:table-cell">Set Diff</th>
                                        <th className="p-4 text-center">Game Diff</th>
                                        <th className="p-4 text-center hidden md:table-cell">% Vitt.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {stats.map((s, idx) => {
                                        const team = teams.find(t => t.id === s.teamId);
                                        const isTop = idx < config.playoffTeams;
                                        return (
                                            <tr key={s.teamId} className={`hover:bg-slate-700/50 transition-colors ${idx === 0 ? 'bg-yellow-400/5' : ''}`}>
                                                <td className="p-4 font-mono text-slate-400">
                                                    {idx + 1}
                                                    {isTop && config.playoffTeams > 0 && <span className="ml-1 text-green-400 text-[10px] uppercase font-bold">Q</span>}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-semibold text-white flex items-center gap-2">
                                                        {team?.name}
                                                    </div>
                                                    {team && team.players.length > 0 && config.mode !== 'SINGLES' && (
                                                        <div className="text-xs text-slate-400 flex flex-wrap gap-1 mt-1">
                                                            {team.players.map(p => (
                                                                <span key={p} className={`flex items-center gap-0.5 ${p === team.captain ? 'text-yellow-400' : ''}`}>
                                                                    {p} {p === team.captain && <Crown size={8} className="fill-current"/>}
                                                                    {p !== team.players[team.players.length-1] && <span className="text-slate-600">, </span>}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center font-bold text-padel-court text-lg">{s.points}</td>
                                                <td className="p-4 text-center text-slate-300 hidden sm:table-cell">{s.played}</td>
                                                <td className="p-4 text-center text-green-400 hidden sm:table-cell">{s.won}</td>
                                                <td className="p-4 text-center text-red-400 hidden sm:table-cell">{s.lost}</td>
                                                <td className="p-4 text-center text-slate-400 hidden md:table-cell">
                                                    {s.setsWon - s.setsLost > 0 ? '+' : ''}{s.setsWon - s.setsLost}
                                                </td>
                                                <td className="p-4 text-center text-slate-300 font-mono">
                                                    {s.gamesWon - s.gamesLost > 0 ? '+' : ''}{s.gamesWon - s.gamesLost}
                                                </td>
                                                <td className="p-4 text-center text-slate-500 hidden md:table-cell text-sm">
                                                    {s.winRate.toFixed(0)}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Activity size={20} className="text-padel-ball"/> Punti Squadra</h3>
                        <div className="h-64">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats}>
                                    <XAxis dataKey="teamId" tickFormatter={(id) => teams.find(t => t.id === id)?.name.substring(0, 5) + '..' || ''} stroke="#64748b" />
                                    <YAxis stroke="#64748b" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff' }}
                                        cursor={{ fill: '#334155', opacity: 0.4 }}
                                        formatter={(val: number) => [val, 'Punti']}
                                        labelFormatter={(id: string) => teams.find(t => t.id === id)?.name || ''}
                                    />
                                    <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                                        {stats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#eab308' : '#3b82f6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                             </ResponsiveContainer>
                        </div>
                    </div>
                    </>
                    )}
                </div>
            )}

            {/* Player Rankings */}
            {activeTab === 'players' && (
                <div className="animate-fade-in space-y-6">
                     <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700">
                        <div className="p-4 bg-slate-900/50 border-b border-slate-700">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Users className="text-padel-ball" /> 
                                Ranking Giocatori 
                                <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">
                                    Ordinato per % Vittoria
                                </span>
                            </h3>
                            <p className="text-slate-500 text-xs mt-1">
                                Statistiche normalizzate sul numero di partite giocate.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-900 text-slate-400 uppercase text-xs font-bold tracking-wider">
                                    <tr>
                                        <th className="p-4">Pos</th>
                                        <th className="p-4">Giocatore</th>
                                        <th className="p-4 text-center">% Vitt.</th>
                                        <th className="p-4 text-center">Set (Media)</th>
                                        <th className="p-4 text-center">Game (Media)</th>
                                        <th className="p-4 text-center text-slate-500">Partite</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {playerStats.map((p, idx) => (
                                        <tr key={p.name} className={`hover:bg-slate-700/50 transition-colors ${idx === 0 ? 'bg-padel-ball/10' : ''}`}>
                                            <td className="p-4 font-mono text-slate-400 w-12">{idx + 1}</td>
                                            <td className="p-4 font-bold text-white group cursor-pointer relative" onClick={() => handleRenamePlayer(p.name)} title="Clicca per rinominare">
                                                {p.name}
                                                {idx === 0 && <Trophy size={14} className="inline ml-2 text-yellow-400"/>}
                                                <Edit3 size={10} className="inline ml-2 text-slate-500 opacity-0 group-hover:opacity-100" />
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded font-bold text-sm ${p.winRate >= 50 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                                    {p.winRate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="p-4 text-center text-slate-300 font-mono">
                                                {p.avgSetDiff > 0 ? '+' : ''}{p.avgSetDiff.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-center text-slate-300 font-mono">
                                                {p.avgGameDiff > 0 ? '+' : ''}{p.avgGameDiff.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-center text-slate-500 text-sm">{p.played}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     </div>
                </div>
            )}
            
            {/* Pro Stats Tab (New) */}
            {activeTab === 'pro' && (
                <div className="animate-fade-in space-y-6">
                    {/* Streaks Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {streaks.slice(0, 6).map((streak, i) => (
                            <div key={streak.name} className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2 relative z-10">
                                    <h4 className="font-bold text-white text-lg">{streak.name}</h4>
                                    <div className={`text-xs font-bold px-2 py-1 rounded ${streak.current > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {streak.current > 0 ? `+${streak.current} Vittorie` : `${streak.current} Sconfitte`}
                                    </div>
                                </div>
                                <div className="flex gap-1 mb-3 relative z-10">
                                    {streak.recent.map((r, idx) => (
                                        <span key={idx} className={`w-3 h-3 rounded-full ${r === 'W' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    ))}
                                    {[...Array(5 - streak.recent.length)].map((_, idx) => (
                                         <span key={`empty-${idx}`} className="w-3 h-3 rounded-full bg-slate-700"></span>
                                    ))}
                                </div>
                                <div className="flex justify-between text-xs text-slate-400 relative z-10">
                                    <span>Best: <span className="text-green-400">+{streak.maxWin}</span></span>
                                    <span>Worst: <span className="text-red-400">-{streak.maxLoss}</span></span>
                                </div>
                                {i === 0 && <Flame size={80} className="absolute -bottom-4 -right-4 text-orange-500/10 z-0" />}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Pair Stats Table */}
                        <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 flex flex-col">
                            <div className="p-4 bg-slate-900/50 border-b border-slate-700">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <Users className="text-blue-400" /> Efficienza Coppie
                                </h3>
                                <p className="text-slate-500 text-xs mt-1">
                                    Performance specifiche per combinazione di giocatori.
                                </p>
                            </div>
                            <div className="overflow-y-auto max-h-[300px] custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-900 text-slate-400 uppercase text-xs font-bold tracking-wider sticky top-0">
                                        <tr>
                                            <th className="p-3">Coppia</th>
                                            <th className="p-3 text-center">G</th>
                                            <th className="p-3 text-center">V</th>
                                            <th className="p-3 text-center">%</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {pairStats.map((pair, idx) => (
                                            <tr key={idx} className="hover:bg-slate-700/50">
                                                <td className="p-3 text-sm text-white">
                                                    <div className="font-bold text-xs">{pair.p1}</div>
                                                    <div className="font-bold text-xs text-slate-400">{pair.p2}</div>
                                                </td>
                                                <td className="p-3 text-center text-slate-400">{pair.played}</td>
                                                <td className="p-3 text-center text-green-400">{pair.won}</td>
                                                <td className="p-3 text-center font-bold">
                                                    <span className={`${pair.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {pair.winRate.toFixed(0)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Distribution Chart */}
                        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-center items-center">
                            <h3 className="text-white font-bold mb-4 w-full text-left flex items-center gap-2">
                                <Activity size={20} className="text-padel-ball"/> Distribuzione Vittorie
                            </h3>
                            <div className="w-full h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={playerStats.slice(0, 5) as any[]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="won"
                                        >
                                            {playerStats.slice(0, 5).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Top 5 giocatori per vittorie assolute</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Matches View */}
            {activeTab === 'matches' && (
                <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-padel-court font-bold mb-4 uppercase tracking-wider text-sm sticky top-20 bg-slate-950 py-2 z-10 border-b border-slate-800/50">
                            Match in Corso
                        </h3>
                        {regularMatches.length === 0 ? (
                             <div className="text-slate-500 text-center py-10">Nessuna partita generata.</div>
                        ) : (
                            regularMatches.map(m => (
                                <MatchCard key={m.id} match={m} teams={teams} onUpdate={onUpdateMatch} mode={config.mode} />
                            ))
                        )}
                    </div>
                    
                    <div>
                        <h3 className="text-padel-ball font-bold mb-4 uppercase tracking-wider text-sm sticky top-20 bg-slate-950 py-2 z-10 border-b border-slate-800/50">
                            Fase Finale (Playoff)
                        </h3>
                        {config.mode === 'AMERICANO' ? (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 text-center">
                                <Shuffle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500">I playoff non sono disponibili nella modalità Americano.</p>
                            </div>
                        ) : playoffMatches.length > 0 ? (
                             playoffMatches.map(m => (
                                <MatchCard key={m.id} match={m} teams={teams} onUpdate={onUpdateMatch} mode={config.mode} />
                            ))
                        ) : (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 text-center">
                                <Shield className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500">I playoff verranno generati automaticamente al termine del girone se previsti dalla configurazione.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* AI Analysis Tab */}
            {activeTab === 'analysis' && (
                <div className="animate-fade-in max-w-2xl mx-auto">
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl p-8 border border-indigo-700/50 shadow-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-32 bg-padel-court blur-[100px] opacity-20 pointer-events-none"></div>
                         
                         <div className="relative z-10">
                            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                <div className="bg-white text-indigo-900 p-2 rounded-lg">
                                    <Activity size={24} />
                                </div>
                                L'Analisi del Coach
                            </h3>
                            
                            <div className="bg-slate-950/60 rounded-lg p-6 text-slate-200 leading-relaxed min-h-[150px] shadow-inner border border-white/10">
                                {loadingAi ? (
                                    <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                                        <div className="w-2 h-2 bg-padel-court rounded-full animate-bounce" style={{ animationDelay: '0s'}}></div>
                                        <div className="w-2 h-2 bg-padel-court rounded-full animate-bounce" style={{ animationDelay: '0.2s'}}></div>
                                        <div className="w-2 h-2 bg-padel-court rounded-full animate-bounce" style={{ animationDelay: '0.4s'}}></div>
                                        Generazione analisi in corso...
                                    </div>
                                ) : aiAnalysis ? (
                                    <p>{aiAnalysis}</p>
                                ) : (
                                    <p className="text-slate-500 italic text-center">Premi il pulsante per analizzare il torneo.</p>
                                )}
                            </div>

                            <button 
                                onClick={handleGenerateAnalysis}
                                disabled={loadingAi}
                                className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg border-t border-indigo-400 disabled:opacity-50"
                            >
                                {aiAnalysis ? 'Aggiorna Analisi' : 'Chiedi al Coach'}
                            </button>
                         </div>
                    </div>
                </div>
            )}

            <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                 <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-slate-700 transition-colors text-xs"
                    >
                        <FileDown size={14} /> Scarica PDF
                    </button>
                    <button 
                        onClick={onExport}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-slate-700 transition-colors text-xs"
                    >
                        <Download size={14} /> Esporta Torneo
                    </button>
                     <button 
                        onClick={onFullBackup}
                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg border border-slate-600 transition-colors text-xs"
                    >
                        <Database size={14} /> Backup Completo
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-slate-700 transition-colors text-xs"
                    >
                        <Upload size={14} /> Ripristina
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json,application/json" 
                        className="hidden" 
                    />
                 </div>

                 <button onClick={onReset} className="text-slate-600 text-sm hover:text-red-400 underline">
                    Resetta Torneo (Cancella tutto)
                 </button>
            </div>
        </div>
    );
};

export default function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [config, setConfig] = useState<TournamentConfig | null>(null);
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  // Load from local storage
  useEffect(() => {
    const savedConfig = localStorage.getItem('padelConfig');
    const savedTeams = localStorage.getItem('padelTeams');
    const savedMatches = localStorage.getItem('padelMatches');
    const savedLogo = localStorage.getItem('padelClubLogo');

    if (savedLogo) {
        setCustomLogo(savedLogo);
    }

    if (savedConfig && savedTeams && savedMatches) {
        try {
            const parsedConfig = JSON.parse(savedConfig);
            const parsedTeams = JSON.parse(savedTeams).map((t: any) => ({
                ...t,
                players: t.players || [], // Backward compatibility
                captain: t.captain || undefined
            }));
            const parsedMatches = JSON.parse(savedMatches);

            setConfig(parsedConfig);
            setTeams(parsedTeams);
            setMatches(parsedMatches);
        } catch (e) {
            console.error("Error loading state", e);
            localStorage.clear();
        }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    if (config) localStorage.setItem('padelConfig', JSON.stringify(config));
    if (teams.length) localStorage.setItem('padelTeams', JSON.stringify(teams));
    if (matches.length) localStorage.setItem('padelMatches', JSON.stringify(matches));
  }, [config, teams, matches]);

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const result = ev.target?.result as string;
              setCustomLogo(result);
              localStorage.setItem('padelClubLogo', result);
          };
          reader.readAsDataURL(file);
      }
  };
  
  // Save specific snapshot to archive
  const saveToArchive = () => {
      if (!config) return;
      const archive: TournamentArchive = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          name: config.name,
          config,
          teams,
          matches
      };
      const existing = localStorage.getItem('padelArchive');
      const list = existing ? JSON.parse(existing) : [];
      localStorage.setItem('padelArchive', JSON.stringify([...list, archive]));
  }
  
  const startTournament = (newTeams: Team[], newConfig: TournamentConfig) => {
    setTeams(newTeams);
    setConfig(newConfig);
    const newMatches = generateSchedule(newTeams, newConfig.doubleRound, newConfig.mode);
    setMatches(newMatches);
  };

  const handleSystemBackup = () => {
      // Create a master object
      const archive = JSON.parse(localStorage.getItem('padelArchive') || '[]');
      const registry = JSON.parse(localStorage.getItem('padelRegistryDraft') || '[]');
      const logo = localStorage.getItem('padelClubLogo');
      
      const current = config ? { config, teams, matches } : null;

      const fullBackup = {
          type: 'FULL_BACKUP',
          timestamp: new Date().toISOString(),
          archive,
          registry,
          logo,
          current
      };
      
      const jsonString = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SULMONA_SYSTEM_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportData = (data: any) => {
    // 1. FULL SYSTEM RESTORE
    if (data.type === 'FULL_BACKUP') {
        const msg = `Rilevato BACKUP COMPLETO del sistema (${new Date(data.timestamp).toLocaleString()}).\n\nVuoi ripristinare TUTTO?\n(Archivio, Albo, Logo e Torneo Attuale)\n\nATTENZIONE: I dati correnti verranno sovrascritti.`;
        if (window.confirm(msg)) {
            try {
                if (data.archive) localStorage.setItem('padelArchive', JSON.stringify(data.archive));
                if (data.registry) localStorage.setItem('padelRegistryDraft', JSON.stringify(data.registry));
                if (data.logo) {
                    localStorage.setItem('padelClubLogo', data.logo);
                    setCustomLogo(data.logo);
                }
                
                if (data.current && data.current.config) {
                     setConfig(data.current.config);
                     // Sanitize teams (missing players array fix)
                     const sanitizedTeams = (data.current.teams || []).map((t:any) => ({
                         ...t,
                         players: t.players || []
                     }));
                     setTeams(sanitizedTeams);
                     setMatches(data.current.matches || []);
                     
                     localStorage.setItem('padelConfig', JSON.stringify(data.current.config));
                     localStorage.setItem('padelTeams', JSON.stringify(sanitizedTeams));
                     localStorage.setItem('padelMatches', JSON.stringify(data.current.matches || []));
                } else {
                     setConfig(null);
                     setTeams([]);
                     setMatches([]);
                     localStorage.removeItem('padelConfig');
                     localStorage.removeItem('padelTeams');
                     localStorage.removeItem('padelMatches');
                }
                
                alert("Ripristino completato! La pagina verrà ricaricata.");
                window.location.reload();
            } catch (e) {
                alert("Errore critico nel ripristino del backup.");
            }
        }
        return;
    }

    // 2. ARCHIVE ARRAY RESTORE
    if (Array.isArray(data)) {
        if (data.length === 0) {
            alert("Il file contiene un archivio vuoto.");
            return;
        }
        const last = data[data.length-1];
        const msg = `Hai caricato un file ARCHIVIO con ${data.length} tornei.\nVuoi caricare l'ULTIMO torneo presente (${last.name}) come torneo attivo?\n\n(L'archivio storico NON verrà modificato, solo il torneo attuale)`;
        if (window.confirm(msg)) {
            if (last.config && last.teams) {
                 setConfig(last.config);
                 const sanitizedTeams = (last.teams || []).map((t:any) => ({...t, players: t.players || []}));
                 setTeams(sanitizedTeams);
                 setMatches(last.matches || []);
                 alert("Torneo caricato con successo!");
            }
        }
        return;
    }

    // 3. SINGLE TOURNAMENT RESTORE
    const missing = [];
    if (!data.config) missing.push('config');
    if (!data.teams) missing.push('teams');
    
    // If it lacks matches, we might generate them, but usually export has them.
    // If no matches key, we assume new or reset.

    if (missing.length > 0) {
        alert(`File non valido. Mancano i seguenti dati: ${missing.join(', ')}.\nAssicurati di caricare il file JSON corretto.`);
        return;
    }

    const confirmMsg = config 
        ? "Attenzione: caricando questo file sovrascriverai il torneo attuale. Continuare?" 
        : "Caricare i dati del torneo salvato?";
    
    if (window.confirm(confirmMsg)) {
        try {
            setConfig(data.config);
            // Sanitize
            const sanitizedTeams = (data.teams || []).map((t:any) => ({
                ...t,
                players: t.players || [],
                captain: t.captain || undefined
            }));
            setTeams(sanitizedTeams);
            setMatches(data.matches || []);
            alert("Torneo caricato con successo!");
        } catch (e) {
            alert("Errore durante il caricamento dei dati.");
        }
    }
  };

  const handleExportData = () => {
      const data = {
          config,
          teams,
          matches,
          timestamp: new Date().toISOString()
      };
      
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `padel-tournament-${config?.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const updateMatch = (updatedMatch: Match) => {
    const updatedMatches = matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    
    // Playoff Automatic Advancement Logic
    if (updatedMatch.isPlayoff && updatedMatch.winnerId && updatedMatch.nextMatchId) {
         const nextMatchIndex = updatedMatches.findIndex(m => m.id === updatedMatch.nextMatchId);
         if (nextMatchIndex !== -1) {
             const nextMatch = {...updatedMatches[nextMatchIndex]};
             if (updatedMatch.nextMatchSlot === 'A') {
                 nextMatch.teamAId = updatedMatch.winnerId;
             } else if (updatedMatch.nextMatchSlot === 'B') {
                 nextMatch.teamBId = updatedMatch.winnerId;
             }
             updatedMatches[nextMatchIndex] = nextMatch;
         }
    }

    setMatches(updatedMatches);
    
    // Check for playoff generation trigger (Only for Doubles/Singles)
    if (config && config.mode !== 'AMERICANO' && config.playoffTeams > 0) {
        const regularMatches = updatedMatches.filter(m => !m.isPlayoff);
        const allPlayed = regularMatches.every(m => m.played);
        const playoffsExist = updatedMatches.some(m => m.isPlayoff);

        if (allPlayed && !playoffsExist) {
            generatePlayoffs(updatedMatches, config.playoffTeams);
        }
    }
  };

  const generatePlayoffs = (currentMatches: Match[], numTeams: number) => {
      if (!config) return;
      const stats = calculateStats(teams, currentMatches.filter(m => !m.isPlayoff), config.mode);
      
      let effectiveNumTeams = numTeams;
      if (numTeams === -1) {
          effectiveNumTeams = Math.pow(2, Math.floor(Math.log2(stats.length)));
          if (stats.length >= 16) effectiveNumTeams = 16;
          else if (stats.length >= 8) effectiveNumTeams = 8;
          else if (stats.length >= 4) effectiveNumTeams = 4;
          else effectiveNumTeams = 2;
      }
      
      const topTeamsIds = stats.slice(0, effectiveNumTeams).map(s => s.teamId);
      const newPlayoffMatches: Match[] = [];

      if (effectiveNumTeams === 2) {
          newPlayoffMatches.push({
              id: 'final',
              teamAId: topTeamsIds[0],
              teamBId: topTeamsIds[1],
              round: 99,
              score: null,
              played: false,
              isPlayoff: true,
              playoffLabel: 'Finale'
          });
      } else if (effectiveNumTeams === 4) {
          newPlayoffMatches.push({
              id: 'semi-1',
              teamAId: topTeamsIds[0],
              teamBId: topTeamsIds[3],
              round: 98,
              score: null,
              played: false,
              isPlayoff: true,
              playoffLabel: 'Semifinale A',
              nextMatchId: 'final',
              nextMatchSlot: 'A'
          });
           newPlayoffMatches.push({
              id: 'semi-2',
              teamAId: topTeamsIds[1],
              teamBId: topTeamsIds[2],
              round: 98,
              score: null,
              played: false,
              isPlayoff: true,
              playoffLabel: 'Semifinale B',
              nextMatchId: 'final',
              nextMatchSlot: 'B'
          });
           newPlayoffMatches.push({
              id: 'final',
              teamAId: 'winner-semi-1',
              teamBId: 'winner-semi-2',
              round: 99,
              score: null,
              played: false,
              isPlayoff: true,
              playoffLabel: 'Finale'
          });
      }
      
      setMatches([...currentMatches, ...newPlayoffMatches]);
  };

  const resetTournament = () => {
    if(window.confirm("Sei sicuro? Perderai tutti i dati.")) {
        if (config) saveToArchive();
        localStorage.removeItem('padelConfig');
        localStorage.removeItem('padelTeams');
        localStorage.removeItem('padelMatches');
        setConfig(null);
        setTeams([]);
        setMatches([]);
    }
  };
  
  const goHome = () => {
      setConfig(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-padel-court selection:text-white">
      <Header onGoHome={goHome} showHome={!!config} logo={customLogo} onLogoUpload={handleLogoUpload} />
      <main className="container mx-auto">
        {!config ? (
          <SetupScreen onStart={startTournament} onImport={handleImportData} onFullBackup={handleSystemBackup} />
        ) : (
          <Dashboard 
            teams={teams} 
            matches={matches} 
            config={config} 
            onUpdateMatch={updateMatch}
            onReset={resetTournament}
            onExport={handleExportData}
            onImport={handleImportData}
            onFullBackup={handleSystemBackup}
          />
        )}
      </main>
    </div>
  );
}
