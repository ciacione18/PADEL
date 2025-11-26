import { GoogleGenAI } from "@google/genai";
import { Team, TeamStats, Match } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateTournamentAnalysis = async (
  teams: Team[],
  stats: TeamStats[],
  matches: Match[]
): Promise<string> => {
  const client = getClient();
  if (!client) return "API Key mancante. Configura la chiave per l'analisi AI.";

  const playedMatches = matches.filter(m => m.played);
  if (playedMatches.length === 0) return "Gioca qualche partita per ricevere l'analisi del Coach!";

  // Serialize data for the prompt
  const standingsStr = stats
    .sort((a, b) => b.points - a.points)
    .map((s, i) => {
      const team = teams.find(t => t.id === s.teamId);
      const teamName = team?.name || 'Sconosciuto';
      
      // Format players list, marking the captain
      const players = team?.players.map(p => 
        p === team.captain ? `${p} (C)` : p
      ).join(' & ') || '';

      return `${i + 1}. ${teamName} [${players}] (Pt: ${s.points}, G: ${s.played}, V: ${s.won})`;
    })
    .join('\n');

  const recentMatchesStr = playedMatches
    .slice(-3)
    .map(m => {
      const tA = teams.find(t => t.id === m.teamAId);
      const tB = teams.find(t => t.id === m.teamBId);
      const s = m.score;
      const scoreStr = s ? `${s.set1.a}-${s.set1.b}, ${s.set2.a}-${s.set2.b}` : '';
      return `${tA?.name} vs ${tB?.name}: ${scoreStr}`;
    })
    .join('\n');

  const prompt = `
    Sei un commentatore sportivo esperto ed energico di Padel.
    Analizza brevemente l'andamento del torneo.
    
    Classifica attuale (con giocatori, (C) indica il Capitano):
    ${standingsStr}

    Ultime partite:
    ${recentMatchesStr}

    Dai un giudizio sulle prestazioni, menziona i giocatori chiave e cita l'operato dei capitani se rilevante. 
    Usa un tono divertente ma professionale, stile telecronaca sportiva italiana. 
    Massimo 120 parole.
  `;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "Analisi non disponibile.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Il Coach AI è in pausa caffè (Errore connessione).";
  }
};