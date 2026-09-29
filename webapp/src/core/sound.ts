/**
 * A notification raised by the operating system plays whatever tone the phone's
 * notification settings say, and no web app can override that. What an app can
 * do is play its own tone when a reminder lands while it is open, which is what
 * this is. Everything is synthesised, so there are no audio files to download
 * and it still works with no signal.
 */

export type SoundName = 'chime' | 'bell' | 'marimba' | 'pulse' | 'rise' | 'none';

export interface SoundChoice {
  readonly id: SoundName;
  readonly label: string;
  readonly note: string;
}

export const SOUNDS: readonly SoundChoice[] = [
  { id: 'chime', label: 'Chime', note: 'Two soft notes, the default' },
  { id: 'bell', label: 'Bell', note: 'One struck bell that rings out' },
  { id: 'marimba', label: 'Marimba', note: 'Three wooden notes climbing' },
  { id: 'pulse', label: 'Pulse', note: 'Quiet, repeating, easy to ignore' },
  { id: 'rise', label: 'Rise', note: 'A short ascending phrase' },
  { id: 'none', label: 'Silent', note: 'No tone from the app itself' }
];

let context: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!context) context = new AudioContext();
  return context;
}

/** Browsers refuse to make noise until the person has interacted; call this then. */
export function unlockAudio(): void {
  const audio = ctx();
  if (audio && audio.state === 'suspended') void audio.resume();
}

interface Note {
  readonly freq: number;
  /** Seconds from the start of the sound. */
  readonly at: number;
  readonly length: number;
  readonly gain: number;
  readonly type: OscillatorType;
}

const SCORES: Record<Exclude<SoundName, 'none'>, Note[]> = {
  chime: [
    { freq: 659.25, at: 0, length: 1.1, gain: 0.22, type: 'sine' },
    { freq: 987.77, at: 0.14, length: 1.3, gain: 0.18, type: 'sine' }
  ],
  bell: [
    { freq: 830.61, at: 0, length: 1.8, gain: 0.2, type: 'sine' },
    { freq: 1661.22, at: 0, length: 1.1, gain: 0.07, type: 'sine' },
    { freq: 2489.0, at: 0, length: 0.6, gain: 0.035, type: 'sine' }
  ],
  marimba: [
    { freq: 523.25, at: 0, length: 0.35, gain: 0.24, type: 'triangle' },
    { freq: 659.25, at: 0.13, length: 0.35, gain: 0.22, type: 'triangle' },
    { freq: 783.99, at: 0.26, length: 0.5, gain: 0.2, type: 'triangle' }
  ],
  pulse: [
    { freq: 440, at: 0, length: 0.14, gain: 0.16, type: 'sine' },
    { freq: 440, at: 0.22, length: 0.14, gain: 0.16, type: 'sine' },
    { freq: 440, at: 0.44, length: 0.2, gain: 0.16, type: 'sine' }
  ],
  rise: [
    { freq: 392, at: 0, length: 0.22, gain: 0.18, type: 'sine' },
    { freq: 523.25, at: 0.1, length: 0.22, gain: 0.18, type: 'sine' },
    { freq: 659.25, at: 0.2, length: 0.28, gain: 0.18, type: 'sine' },
    { freq: 783.99, at: 0.3, length: 0.7, gain: 0.2, type: 'sine' }
  ]
};

/** Plays the chosen tone. Returns false when nothing could be played. */
export function playSound(name: SoundName): boolean {
  if (name === 'none') return true;
  const audio = ctx();
  if (!audio) return false;
  if (audio.state === 'suspended') void audio.resume();

  const master = audio.createGain();
  master.gain.value = 1;
  master.connect(audio.destination);

  const start = audio.currentTime + 0.02;
  for (const note of SCORES[name]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = note.type;
    osc.frequency.setValueAtTime(note.freq, start + note.at);

    /* a quick attack and a long decay, so it reads as a struck instrument */
    gain.gain.setValueAtTime(0.0001, start + note.at);
    gain.gain.exponentialRampToValueAtTime(note.gain, start + note.at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.length);

    osc.connect(gain);
    gain.connect(master);
    osc.start(start + note.at);
    osc.stop(start + note.at + note.length + 0.05);
  }
  return true;
}

export function soundLabel(name: SoundName): string {
  return SOUNDS.find((s) => s.id === name)?.label ?? 'Chime';
}
