import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, BookOpen, Dumbbell, Pencil, Trash2, ToggleLeft, ToggleRight, UserPlus } from 'lucide-react'
import { RichTextView } from '@/components/ui/RichTextEditor'
import { Button } from '@/components/ui/button'
import { atualizarProtocolo, deletarProtocolo, type Protocolo } from '../api'
import { GanttProtocolo } from './GanttProtocolo'
import { AplicarProtocoloModal } from './AplicarProtocoloModal'
import { useAuth } from '@/lib/AuthContext'

interface Props { protocolo: Protocolo }

export function DetalheProtocolo({ protocolo }: Props) {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [fasesAbertas, setFasesAbertas] = useState<Set<string>>(new Set([protocolo.protocolo_fase[0]?.id]))
  const [loadingToggle, setLoadingToggle] = useState(false)
  const [aplicarAberto, setAplicarAberto] = useState(false)

  const podeEditar = profissional?.papeis?.some(p => p === 'coordenador' || p === 'admin')

  const fases = [...protocolo.protocolo_fase].sort((a, b) => a.ordem - b.ordem)

  function toggleFase(id: string) {
    setFasesAbertas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function toggleAtivo() {
    setLoadingToggle(true)
    try {
      await atualizarProtocolo(protocolo.id, { ativo: !protocolo.ativo })
      qc.invalidateQueries({ queryKey: ['protocolo', protocolo.id] })
      qc.invalidateQueries({ queryKey: ['protocolos'] })
    } finally { setLoadingToggle(false) }
  }

  async function handleDeletar() {
    if (!confirm('Deletar este protocolo permanentemente?')) return
    await deletarProtocolo(protocolo.id)
    qc.invalidateQueries({ queryKey: ['protocolos'] })
    navigate('/protocolos')
  }

  return (
    <><div className="space-y-6 max-w-2xl">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
              {protocolo.lesao}
            </span>
            {!protocolo.ativo && (
              <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Inativo</span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{protocolo.nome}</h1>
          {protocolo.autor && (
            <p className="text-xs text-gray-500 mt-1">Criado por {protocolo.autor.nome}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {protocolo.ativo && (
            <Button size="sm" onClick={() => setAplicarAberto(true)}>
              <UserPlus size={14} /> Aplicar a paciente
            </Button>
          )}
          {podeEditar && (
            <>
              <button
                onClick={toggleAtivo}
                disabled={loadingToggle}
                title={protocolo.ativo ? 'Desativar' : 'Reativar'}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
              >
                {protocolo.ativo ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} />}
              </button>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/protocolos/${protocolo.id}/editar`)}>
                <Pencil size={14} /> Editar
              </Button>
              {profissional?.papeis?.includes('admin') && (
                <button onClick={handleDeletar} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Descrição clínica */}
      {protocolo.descricao && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Descrição clínica</span>
          </div>
          <RichTextView html={protocolo.descricao} />
        </div>
      )}

      {protocolo.referencia && (
        <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-3">
          📄 {protocolo.referencia}
        </p>
      )}

      {/* Linha do tempo — Gantt */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Planejamento do tratamento
        </h2>
        <GanttProtocolo fases={fases} />
      </div>

      {/* Fases — detalhe expansível */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {fases.length} fase{fases.length !== 1 ? 's' : ''} · {fases[fases.length - 1]?.semana_fim ?? 0} semanas no total
        </h2>
        <div className="space-y-2">
          {fases.map(fase => {
            const aberta = fasesAbertas.has(fase.id)
            return (
              <div key={fase.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer select-none"
                  onClick={() => toggleFase(fase.id)}
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    {fase.ordem}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-800">{fase.nome}</span>
                  <span className="text-xs text-gray-500 shrink-0">Sem. {fase.semana_inicio}–{fase.semana_fim}</span>
                  {aberta ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </div>

                {aberta && (
                  <div className="px-4 py-4">
                    {(() => {
                      const sorted = [...fase.protocolo_fase_exercicio].sort((a, b) => a.ordem - b.ordem)

                      // Monta lista de objetivos na ordem definida, mais "sem objetivo" no fim
                      const objetivosOrdenados = fase.objetivos.filter(o => o.texto.trim())
                      const textosSemOrdem = sorted
                        .map(ex => ex.objetivo_texto?.trim() || '')
                        .filter(t => t && !objetivosOrdenados.some(o => o.texto === t))
                      const semObjetivoExs = sorted.filter(ex => !ex.objetivo_texto?.trim())

                      // Agrupa exercícios por objetivo_texto
                      const grupos: Record<string, typeof sorted> = {}
                      for (const ex of sorted) {
                        const key = ex.objetivo_texto?.trim() || '__sem_objetivo__'
                        if (!grupos[key]) grupos[key] = []
                        grupos[key].push(ex)
                      }

                      const linhas: { obj: typeof objetivosOrdenados[0] | null; texto: string; exercicios: typeof sorted }[] = [
                        ...objetivosOrdenados.map(obj => ({
                          obj,
                          texto: obj.texto,
                          exercicios: grupos[obj.texto] ?? [],
                        })),
                        ...textosSemOrdem.map(t => ({
                          obj: null,
                          texto: t,
                          exercicios: grupos[t] ?? [],
                        })),
                        ...(semObjetivoExs.length > 0 ? [{ obj: null, texto: '__sem_objetivo__', exercicios: semObjetivoExs }] : []),
                      ]

                      if (linhas.length === 0) return (
                        <p className="text-xs text-gray-400 italic">Nenhum conteúdo nesta fase.</p>
                      )

                      return (
                        <div className="rounded-lg border border-gray-200 overflow-hidden">
                          {/* Cabeçalho */}
                          <div className="grid grid-cols-[1fr_2fr] bg-gray-50 border-b border-gray-200">
                            <div className="px-4 py-2 flex items-center gap-1.5 border-r border-gray-200">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Objetivo</span>
                            </div>
                            <div className="px-4 py-2 flex items-center gap-1.5">
                              <Dumbbell size={12} className="text-gray-400" />
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Exercícios / Terapias</span>
                            </div>
                          </div>

                          {/* Linhas por objetivo */}
                          {linhas.map(({ obj, texto, exercicios }, li) => (
                            <div key={texto} className={`grid grid-cols-[1fr_2fr] ${li < linhas.length - 1 ? 'border-b border-gray-200' : ''}`}>
                              {/* Coluna Objetivo */}
                              <div className="px-4 py-3 border-r border-gray-200 bg-blue-50/40 flex flex-col justify-start">
                                {texto === '__sem_objetivo__' ? (
                                  <span className="text-xs text-gray-400 italic">Sem objetivo definido</span>
                                ) : (
                                  <>
                                    <span className="text-sm font-medium text-blue-800 leading-snug">{texto}</span>
                                    {obj && (obj.semana_inicio != null || obj.semana_fim != null) && (
                                      <span className="text-xs text-blue-500 mt-1">
                                        Sem. {obj.semana_inicio ?? fase.semana_inicio}–{obj.semana_fim ?? fase.semana_fim}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>

                              {/* Coluna Exercícios */}
                              <div className="px-4 py-3 space-y-2">
                                {exercicios.length === 0 ? (
                                  <span className="text-xs text-gray-400 italic">Nenhum exercício vinculado.</span>
                                ) : exercicios.map(ex => (
                                  <div key={ex.id} className="flex items-start gap-2">
                                    <span className="text-blue-300 mt-0.5 shrink-0 text-xs">▸</span>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-medium text-gray-800">{ex.exercicio?.nome}</span>
                                      {ex.exercicio?.grupo_muscular && (
                                        <span className="text-xs text-gray-400 ml-2">{ex.exercicio.grupo_muscular}</span>
                                      )}
                                      {ex.nota && (
                                        <span className="text-xs text-gray-500 ml-2">· {ex.nota}</span>
                                      )}
                                      {(ex.semana_inicio != null || ex.semana_fim != null) && (
                                        <span className="text-xs text-gray-400 ml-2">
                                          (sem. {ex.semana_inicio ?? fase.semana_inicio}–{ex.semana_fim ?? fase.semana_fim})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>

      {aplicarAberto && (
        <AplicarProtocoloModal
          protocoloId={protocolo.id}
          onClose={() => setAplicarAberto(false)}
        />
      )}
    </>
  )
}
