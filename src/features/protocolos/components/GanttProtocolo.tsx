import type { ProtocoloFase } from '../api'

interface Props {
  fases: ProtocoloFase[]
}

interface ObjetivoLinha {
  texto: string
  semana_inicio: number
  semana_fim: number
}

const FASE_CORES = [
  { header: 'bg-[#2d4a7a] text-white', celula: 'bg-[#dbe4f0] text-gray-800' },
  { header: 'bg-[#1f6b55] text-white', celula: 'bg-[#d4ede7] text-gray-800' },
  { header: 'bg-[#7a3d1f] text-white', celula: 'bg-[#f0e4d8] text-gray-800' },
  { header: 'bg-[#5a2d7a] text-white', celula: 'bg-[#ead8f0] text-gray-800' },
  { header: 'bg-[#1f4a6b] text-white', celula: 'bg-[#d8eaf0] text-gray-800' },
]

export function GanttProtocolo({ fases }: Props) {
  const fasesOrdenadas = [...fases].sort((a, b) => a.ordem - b.ordem)
  const totalSemanas = fasesOrdenadas[fasesOrdenadas.length - 1]?.semana_fim ?? 0

  if (totalSemanas === 0) return null

  // Agrupa objetivos em linhas: objetivos que se encaixam sem sobreposição ficam na mesma linha
  const linhas: ObjetivoLinha[][] = []

  for (const fase of fasesOrdenadas) {
    for (const obj of fase.objetivos) {
      if (!obj.texto.trim()) continue
      // Se um lado está definido e o outro não, usa o limite da fase
      const temAlgum = obj.semana_inicio != null || obj.semana_fim != null
      const ini = obj.semana_inicio ?? (temAlgum ? fase.semana_inicio : fase.semana_inicio)
      const fim = obj.semana_fim ?? (temAlgum ? fase.semana_fim : fase.semana_fim)
      const novoObj: ObjetivoLinha = { texto: obj.texto, semana_inicio: ini, semana_fim: fim }

      // Tenta encaixar em uma linha existente sem sobreposição
      let encaixou = false
      for (const linha of linhas) {
        const sobrepos = linha.some(o => ini <= o.semana_fim && fim >= o.semana_inicio)
        if (!sobrepos) {
          linha.push(novoObj)
          encaixou = true
          break
        }
      }
      if (!encaixou) linhas.push([novoObj])
    }
  }

  // Mapeia semana → índice de fase (para colorir células)
  const semanaPorFase: Record<number, number> = {}
  fasesOrdenadas.forEach((fase, fi) => {
    for (let s = fase.semana_inicio; s <= fase.semana_fim; s++) {
      semanaPorFase[s] = fi
    }
  })

  const semanas = Array.from({ length: totalSemanas }, (_, i) => i + 1)

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-xs" style={{ minWidth: totalSemanas * 72 }}>
        {/* Colgroup para largura uniforme */}
        <colgroup>
          {semanas.map(s => <col key={s} style={{ width: `${100 / totalSemanas}%` }} />)}
        </colgroup>

        <thead>
          {/* Linha 1 — Fases */}
          <tr>
            {fasesOrdenadas.map((fase, fi) => {
              const cor = FASE_CORES[fi % FASE_CORES.length]
              const span = fase.semana_fim - fase.semana_inicio + 1
              return (
                <th
                  key={fase.id}
                  colSpan={span}
                  className={`${cor.header} text-center font-semibold py-2 px-1 border border-white/20 uppercase tracking-wide text-[11px]`}
                >
                  {fase.nome}
                </th>
              )
            })}
          </tr>

          {/* Linha 2 — Semanas */}
          <tr>
            {semanas.map(s => {
              const fi = semanaPorFase[s] ?? 0
              const cor = FASE_CORES[fi % FASE_CORES.length]
              return (
                <th
                  key={s}
                  className={`${cor.header} opacity-80 text-center font-medium py-1.5 px-1 border border-white/20`}
                >
                  Sem. {s}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {linhas.map((linha, li) => (
            <tr key={li} className="border-t border-gray-200">
              {(() => {
                const cells: React.ReactNode[] = []
                let s = 1
                // Ordena os objetivos da linha por semana de início
                const sorted = [...linha].sort((a, b) => a.semana_inicio - b.semana_inicio)

                for (const obj of sorted) {
                  // Células vazias antes do objetivo
                  if (s < obj.semana_inicio) {
                    cells.push(
                      <td
                        key={`vazio-${s}`}
                        colSpan={obj.semana_inicio - s}
                        className="border border-gray-100 bg-white py-1.5 px-1"
                      />
                    )
                  }

                  // Célula do objetivo
                  const span = obj.semana_fim - obj.semana_inicio + 1
                  const fi = semanaPorFase[obj.semana_inicio] ?? 0
                  const cor = FASE_CORES[fi % FASE_CORES.length]
                  cells.push(
                    <td
                      key={`obj-${obj.semana_inicio}`}
                      colSpan={span}
                      className={`${cor.celula} border border-gray-200 py-1.5 px-2 text-center font-medium`}
                    >
                      {obj.texto}
                    </td>
                  )
                  s = obj.semana_fim + 1
                }

                // Células vazias depois do último objetivo
                if (s <= totalSemanas) {
                  cells.push(
                    <td
                      key={`vazio-fim`}
                      colSpan={totalSemanas - s + 1}
                      className="border border-gray-100 bg-white py-1.5 px-1"
                    />
                  )
                }

                return cells
              })()}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
