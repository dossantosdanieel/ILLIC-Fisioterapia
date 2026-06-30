/**
 * Utilitário de cálculo de volume e progressão de carga.
 * Volume = séries × repetições × carga_kg  (ou séries × tempo para exercícios de duração)
 */

/** Resistência equivalente em kg para cada tipo de faixa */
export const BAND_KG: Record<string, number> = {
  faixa_leve: 3,        // Decathlon leve ≈ 3 kg
  faixa_moderada: 6,    // Decathlon moderada ≈ 6 kg
  faixa_forte: 12,      // Decathlon forte ≈ 12 kg
  superband_leve: 10,   // Rinoforce leve ≈ 10 kg
  superband_media: 20,  // Rinoforce média ≈ 20 kg
  superband_forte: 40,  // Rinoforce forte ≈ 40 kg
}

export const CARGA_TIPO_LABELS: Record<string, string> = {
  kg: 'kg',
  kgf: 'kgf (dinamômetro)',
  percent_1rm: '% de 1RM',
  rm: 'RM',
  banda_cor: 'Banda (cor)',
  peso_corporal: 'Peso corporal',
  tempo: 'Tempo (seg)',
  faixa_leve: 'Faixa Decathlon Leve (~3 kg)',
  faixa_moderada: 'Faixa Decathlon Moderada (~6 kg)',
  faixa_forte: 'Faixa Decathlon Forte (~12 kg)',
  superband_leve: 'Superband Rinoforce Leve (~10 kg)',
  superband_media: 'Superband Rinoforce Média (~20 kg)',
  superband_forte: 'Superband Rinoforce Forte (~40 kg)',
}

/**
 * Converte carga para kg equivalente.
 * Retorna null para cargas não numéricas (RM, %, peso corporal, banda por cor).
 */
export function cargaParaKg(tipo: string, valor: string): number | null {
  if (tipo === 'kg' || tipo === 'kgf') {
    const n = parseFloat(valor.replace(',', '.'))
    return isNaN(n) ? null : n
  }
  if (tipo in BAND_KG) return BAND_KG[tipo]
  return null
}

export type ModoExercicio = 'reps' | 'tempo' | 'reps_e_tempo'

export function detectarModo(reps: number | null, tempo_seg: number | null): ModoExercicio {
  if (reps && tempo_seg) return 'reps_e_tempo'
  if (tempo_seg && !reps) return 'tempo'
  return 'reps'
}

export interface VolumeResult {
  volume: number
  unidade: string
  descricao: string
}

/**
 * Calcula volume de um exercício.
 *
 * Fórmulas:
 * - Reps + kg: séries × reps × kg
 * - Reps s/ carga (corporal/RM): séries × reps  (unidade: reps)
 * - Tempo + kg: séries × tempo × kg
 * - Só tempo: séries × tempo  (unidade: seg)
 * - Reps + Tempo + kg (excêntrico): séries × reps × kg
 * - Reps + Tempo s/ kg (TUT): séries × reps × tempo  (unidade: s·TUT)
 */
export function calcularVolume(
  series: number,
  reps: number | null,
  tempo_seg: number | null,
  carga_tipo: string,
  carga_valor: string,
): VolumeResult | null {
  const kg = cargaParaKg(carga_tipo, carga_valor)
  const modo = detectarModo(reps, tempo_seg)

  if (modo === 'reps') {
    if (!reps) return null
    if (kg !== null && kg > 0) {
      const v = series * reps * kg
      return { volume: v, unidade: 'kg·reps', descricao: `${series}×${reps}×${kg}kg = ${v.toFixed(0)} kg·reps` }
    }
    const v = series * reps
    return { volume: v, unidade: 'reps', descricao: `${series}×${reps} = ${v} reps` }
  }

  if (modo === 'tempo') {
    if (!tempo_seg) return null
    if (kg !== null && kg > 0) {
      const v = series * tempo_seg * kg
      return { volume: v, unidade: 'kg·s', descricao: `${series}×${tempo_seg}s×${kg}kg = ${v.toFixed(0)} kg·s` }
    }
    const v = series * tempo_seg
    return { volume: v, unidade: 's', descricao: `${series}×${tempo_seg}s = ${v}s` }
  }

  if (modo === 'reps_e_tempo') {
    if (!reps || !tempo_seg) return null
    if (kg !== null && kg > 0) {
      const v = series * reps * kg
      return { volume: v, unidade: 'kg·reps', descricao: `${series}×${reps}×${kg}kg = ${v.toFixed(0)} kg·reps (${tempo_seg}s/rep)` }
    }
    const v = series * reps * tempo_seg
    return { volume: v, unidade: 's·TUT', descricao: `${series}×${reps}×${tempo_seg}s = ${v}s TUT` }
  }

  return null
}

// ── Classificação muscular e thresholds de progressão ─────────

const GRUPOS_GRANDES = [
  'quadríceps', 'quadriceps', 'isquiotibiais', 'posteriores', 'glúteo', 'gluteo', 'glúteos', 'gluteos',
  'adutores', 'adutor', 'peitoral', 'dorsal', 'latíssimo', 'latissimo', 'costas', 'trápezio', 'trapézio',
  'bíceps', 'biceps', 'tríceps', 'triceps', 'deltóide', 'deltoide',
  'panturrilha', 'gastrocnêmio', 'gastrocnemio', 'sóleo', 'soleo',
]

export function classificarGrupo(grupo: string | null): 'grande' | 'pequeno' {
  if (!grupo) return 'pequeno'
  const g = grupo.toLowerCase()
  return GRUPOS_GRANDES.some(gg => g.includes(gg)) ? 'grande' : 'pequeno'
}

export function progressaoEsperada(grupo: 'grande' | 'pequeno'): { min: number; max: number; label: string } {
  return grupo === 'grande'
    ? { min: 0.10, max: 0.15, label: '10–15%' }
    : { min: 0.05, max: 0.10, label: '5–10%' }
}

// ── Sugestão de progressão +5% sobre a última execução ────────

export interface SugestaoProgressao {
  /** Novo valor de carga (mesmo tipo) — null se não se aplica */
  cargaSugerida: string | null
  /** Novas reps — null se não se aplica */
  repsSugeridas: number | null
  /** Novo tempo em segundos — null se não se aplica */
  tempoSugerido: number | null
  volumeAnterior: number
  volumeSugerido: number
  unidade: string
  /** Texto curto para o chip: ex. "8.5 kg" ou "13 reps" */
  descricao: string
}

/** Arredonda carga para granularidade razoável */
function arredondarCarga(kg: number): number {
  if (kg >= 50) return Math.ceil(kg / 2.5) * 2.5
  if (kg >= 20) return Math.ceil(kg)
  return Math.ceil(kg * 2) / 2  // granularidade 0.5 kg
}

/**
 * Sugere a carga/reps/tempo para +5% de volume em relação à última execução.
 * Prioriza aumento de carga; se não for possível (bandas, peso corporal), aumenta reps ou tempo.
 */
export function sugerirProgressao5pct(
  series: number,
  lastReps: number | null,
  lastTempo: number | null,
  lastCarga: string | null,
  cargaTipo: string,
): SugestaoProgressao | null {
  const isBand = cargaTipo in BAND_KG
  const kg = lastCarga && lastCarga !== '0' ? cargaParaKg(cargaTipo, lastCarga) : null

  // ── Peso corporal: aumenta reps ou tempo ──────────────────────────
  if (cargaTipo === 'peso_corporal') {
    if (lastReps && lastReps > 0) {
      const novasReps = Math.max(lastReps + 1, Math.ceil(lastReps * 1.05))
      return {
        cargaSugerida: null, repsSugeridas: novasReps, tempoSugerido: null,
        volumeAnterior: series * lastReps, volumeSugerido: series * novasReps,
        unidade: 'reps', descricao: `${novasReps} reps (+5%)`,
      }
    }
    if (lastTempo && lastTempo > 0) {
      const novoTempo = Math.max(lastTempo + 2, Math.ceil(lastTempo * 1.05))
      return {
        cargaSugerida: null, repsSugeridas: null, tempoSugerido: novoTempo,
        volumeAnterior: series * lastTempo, volumeSugerido: series * novoTempo,
        unidade: 's', descricao: `${novoTempo}s (+5%)`,
      }
    }
    return null
  }

  // ── Bandas elásticas: não ajustável por kg, aumenta reps/tempo ───
  if (isBand) {
    if (!kg) return null
    if (lastReps && lastReps > 0) {
      const novasReps = Math.max(lastReps + 1, Math.ceil(lastReps * 1.05))
      return {
        cargaSugerida: lastCarga, repsSugeridas: novasReps, tempoSugerido: null,
        volumeAnterior: series * lastReps * kg, volumeSugerido: series * novasReps * kg,
        unidade: 'kg·reps', descricao: `${novasReps} reps (faixa mantida)`,
      }
    }
    if (lastTempo && lastTempo > 0) {
      const novoTempo = Math.max(lastTempo + 2, Math.ceil(lastTempo * 1.05))
      return {
        cargaSugerida: lastCarga, repsSugeridas: null, tempoSugerido: novoTempo,
        volumeAnterior: series * lastTempo * kg, volumeSugerido: series * novoTempo * kg,
        unidade: 'kg·s', descricao: `${novoTempo}s (faixa mantida)`,
      }
    }
    return null
  }

  // ── kg / kgf: aumenta carga; se impossível, aumenta reps/tempo ───
  if ((cargaTipo === 'kg' || cargaTipo === 'kgf') && kg !== null && kg > 0) {
    if (lastReps && lastReps > 0) {
      const volAnt = series * lastReps * kg
      const cargaExata = (volAnt * 1.05) / (series * lastReps)
      const cargaRound = arredondarCarga(cargaExata)
      if (cargaRound > kg) {
        return {
          cargaSugerida: String(cargaRound), repsSugeridas: lastReps, tempoSugerido: null,
          volumeAnterior: volAnt, volumeSugerido: series * lastReps * cargaRound,
          unidade: 'kg·reps', descricao: `${cargaRound} kg (${series}×${lastReps} reps)`,
        }
      }
      // arredondamento não subiu → sugere +1 rep
      const novasReps = lastReps + 1
      return {
        cargaSugerida: String(kg), repsSugeridas: novasReps, tempoSugerido: null,
        volumeAnterior: volAnt, volumeSugerido: series * novasReps * kg,
        unidade: 'kg·reps', descricao: `${novasReps} reps (carga ${kg} kg)`,
      }
    }
    if (lastTempo && lastTempo > 0) {
      const volAnt = series * lastTempo * kg
      const cargaExata = (volAnt * 1.05) / (series * lastTempo)
      const cargaRound = arredondarCarga(cargaExata)
      if (cargaRound > kg) {
        return {
          cargaSugerida: String(cargaRound), repsSugeridas: null, tempoSugerido: lastTempo,
          volumeAnterior: volAnt, volumeSugerido: series * lastTempo * cargaRound,
          unidade: 'kg·s', descricao: `${cargaRound} kg (${series}×${lastTempo}s)`,
        }
      }
      const novoTempo = Math.max(lastTempo + 2, Math.ceil(lastTempo * 1.05))
      return {
        cargaSugerida: String(kg), repsSugeridas: null, tempoSugerido: novoTempo,
        volumeAnterior: volAnt, volumeSugerido: series * novoTempo * kg,
        unidade: 'kg·s', descricao: `${novoTempo}s (carga ${kg} kg)`,
      }
    }
    return null
  }

  // ── Sem carga mensurável (% 1RM, RM, banda_cor): aumenta reps/tempo
  if (lastReps && lastReps > 0) {
    const novasReps = Math.max(lastReps + 1, Math.ceil(lastReps * 1.05))
    return {
      cargaSugerida: lastCarga, repsSugeridas: novasReps, tempoSugerido: null,
      volumeAnterior: series * lastReps, volumeSugerido: series * novasReps,
      unidade: 'reps', descricao: `${novasReps} reps (+5%)`,
    }
  }
  if (lastTempo && lastTempo > 0) {
    const novoTempo = Math.max(lastTempo + 2, Math.ceil(lastTempo * 1.05))
    return {
      cargaSugerida: lastCarga, repsSugeridas: null, tempoSugerido: novoTempo,
      volumeAnterior: series * lastTempo, volumeSugerido: series * novoTempo,
      unidade: 's', descricao: `${novoTempo}s (+5%)`,
    }
  }

  return null
}
