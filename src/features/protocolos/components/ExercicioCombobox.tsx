import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Loader2, Check } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface Exercicio {
  id: string
  nome: string
  grupo_muscular: string | null
}

interface Props {
  exercicios: Exercicio[]
  value: string
  onChange: (id: string, nome: string) => void
  disabled?: boolean
}

interface DropdownPos { top: number; left: number; width: number }

export function ExercicioCombobox({ exercicios, value, onChange, disabled }: Props) {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [pos, setPos] = useState<DropdownPos | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selecionado = exercicios.find(e => e.id === value)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
        setBusca('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Recalcula posição ao rolar/redimensionar
  useEffect(() => {
    if (!aberto) return
    function update() {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [aberto])

  // Filtragem por similaridade (inclui partes do nome, case-insensitive)
  const termos = busca.toLowerCase().split(/\s+/).filter(Boolean)
  const filtrados = busca.trim()
    ? exercicios.filter(e => {
        const nome = e.nome.toLowerCase()
        return termos.every(t => nome.includes(t))
      })
    : exercicios

  const exactMatch = exercicios.some(
    e => e.nome.toLowerCase() === busca.trim().toLowerCase()
  )
  const podeCriar = busca.trim().length >= 2 && !exactMatch

  async function handleAdicionar() {
    const nome = busca.trim()
    if (!nome) return
    setAdicionando(true)
    try {
      const { data, error } = await supabaseAdmin
        .from('exercicio')
        .insert({ nome, ativo: true })
        .select('id, nome, grupo_muscular')
        .single()
      if (error) throw error
      // Atualiza cache do catálogo
      qc.invalidateQueries({ queryKey: ['exercicios-catalogo-admin'] })
      onChange(data.id, data.nome)
      setAberto(false)
      setBusca('')
    } finally {
      setAdicionando(false)
    }
  }

  function handleAbrir() {
    if (disabled) return
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setAberto(true)
    setBusca('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSelecionar(ex: Exercicio) {
    onChange(ex.id, ex.nome)
    setAberto(false)
    setBusca('')
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Botão que mostra o valor selecionado */}
      <button
        ref={btnRef}
        type="button"
        onClick={handleAbrir}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-left"
      >
        <span className={selecionado ? 'text-gray-800' : 'text-gray-400'}>
          {selecionado ? selecionado.nome : 'Buscar exercício ou terapia…'}
        </span>
        <Search size={13} className="text-gray-400 shrink-0" />
      </button>

      {/* Dropdown — fixed para escapar de overflow:hidden dos pais */}
      {aberto && pos && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {/* Campo de busca */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Digite para buscar…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setAberto(false); setBusca('') }
                if (e.key === 'Enter' && podeCriar && filtrados.length === 0) handleAdicionar()
                if (e.key === 'Enter' && filtrados.length === 1) handleSelecionar(filtrados[0])
              }}
              className="flex-1 text-sm focus:outline-none"
            />
          </div>

          {/* Lista */}
          <div className="max-h-52 overflow-y-auto">
            {filtrados.length === 0 && !podeCriar && (
              <p className="px-4 py-3 text-xs text-gray-400 italic">Nenhum resultado.</p>
            )}

            {filtrados.map(ex => (
              <button
                key={ex.id}
                type="button"
                onClick={() => handleSelecionar(ex)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors group"
              >
                <div>
                  <p className="text-sm text-gray-800 group-hover:text-blue-800">{ex.nome}</p>
                  {ex.grupo_muscular && (
                    <p className="text-xs text-gray-400">{ex.grupo_muscular}</p>
                  )}
                </div>
                {ex.id === value && <Check size={13} className="text-blue-600 shrink-0" />}
              </button>
            ))}

            {/* Criar novo */}
            {podeCriar && (
              <button
                type="button"
                onClick={handleAdicionar}
                disabled={adicionando}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left border-t border-gray-100 hover:bg-green-50 transition-colors text-green-700 disabled:opacity-60"
              >
                {adicionando
                  ? <Loader2 size={13} className="animate-spin shrink-0" />
                  : <Plus size={13} className="shrink-0" />}
                <span className="text-sm font-medium">
                  {adicionando ? 'Adicionando…' : `Adicionar "${busca.trim()}"`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
