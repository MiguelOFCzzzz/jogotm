const CLOUD = 'dpfgnc10l';
const BASE  = `https://res.cloudinary.com/${CLOUD}/video/upload`;

const AUDIO_URLS: Record<string, string> = {
  guerreiro: `${BASE}/Riyoiki_tenkai_fukuma_mizushi_sound_effect_-_Sound_Effects_youtube_wfg6rz.mp3`,
  mago:      `${BASE}/Gojo_Domain_Expansion_sound_effect_-_Sound_Effects_youtube_fzyp5p.mp3`,
  sombrio:   `${BASE}/Dub_Sung_Jin_Woo_arise_shadow_extraction_Sound_Effect_Solo_leveling_-_Extram_Llama_sx_youtube_rmhsne.mp3`,
  shadow:    `${BASE}/I_Am_Atomic_Sound_effect_-_Kanato_Kazaki_youtube_bcbp90.mp3`,
  aizen:     `${BASE}/Yokoso_Watashi_no_Soul_society_-_Yarenime_youtube_jbadmh.mp3`,
};

let ctx: AudioContext | null = null;
const bufferCache: Record<string, AudioBuffer> = {};
let sourceAtual: AudioBufferSourceNode | null = null;
let gainAtual: GainNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export async function precarregarAudios(): Promise<void> {
  if (typeof window === 'undefined') return;
  const audioCtx = getCtx();
  await Promise.all(
    Object.entries(AUDIO_URLS).map(async ([classe, url]) => {
      try {
        const res  = await fetch(url);
        const arr  = await res.arrayBuffer();
        bufferCache[classe] = await audioCtx.decodeAudioData(arr);
      } catch (e) {
        console.warn(`Falha ao carregar áudio: ${classe}`, e);
      }
    })
  );
}

export function tocarUltimate(classe: string, volume = 0.75): void {
  if (typeof window === 'undefined') return;
  const buffer = bufferCache[classe];
  if (!buffer) return;
  pararAudioImediato();
  const audioCtx = getCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const gain   = audioCtx.createGain();
  gain.gain.value = volume;
  gain.connect(audioCtx.destination);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  source.start(0);
  sourceAtual = source;
  gainAtual   = gain;
}

export function pararAudio(fadeMs = 400): void {
  if (!sourceAtual || !gainAtual || !ctx) return;
  const gain   = gainAtual;
  const source = sourceAtual;
  const now    = ctx.currentTime;
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
  setTimeout(() => { try { source.stop(); } catch {} }, fadeMs + 50);
  sourceAtual = null;
  gainAtual   = null;
}

export function pararAudioImediato(): void {
  if (!sourceAtual) return;
  try { sourceAtual.stop(); } catch {}
  sourceAtual = null;
  gainAtual   = null;
}

export function estaToando(): boolean {
  return sourceAtual !== null;
}