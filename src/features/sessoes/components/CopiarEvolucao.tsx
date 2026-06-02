import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { gerarTextoEvolucao } from '../api'
import type { SessaoRealizadaCompleta, SessaoTemplateCompleta } from '../api'
import { Button } from '@/components/ui/button'

interface Props {
  sessao: SessaoRealizadaCompleta
  template: SessaoTemplateCompleta
  pacienteNome: string
  profissionalNome: string
  crefito: string | null
}

export function CopiarEvolucao({ sessao, template, pacienteNome, profissionalNome, crefito }: Props) {
  const [texto, setTexto] = useState(() =>
    gerarTextoEvolucao(pacienteNome, profissionalNome, crefito, sessao, template),
  )
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Fallback para navegadores sem clipboard API
      const el = document.createElement('textarea')
      el.value = texto
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  const realizados = sessao.execucao_exercicio.filter(e => e.realizado).length
  const total = sessao.execucao_exercicio.length
  const alterados = sessao.execucao_exercicio.filter(e => e.alterado_em_tempo_real).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Copiar evolução para o Zenfisio</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {realizados}/{total} exercícios realizados
            {alterados > 0 && ` · ${alterados} alterado${alterados > 1 ? 's' : ''} em tempo real`}
          </p>
        </div>
        <Button
          onClick={copiar}
          variant={copiado ? 'secondary' : 'primary'}
          size="sm"
        >
          {copiado ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar texto</>}
        </Button>
      </div>

      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={18}
        spellCheck={false}
        className="w-full px-4 py-3 text-sm font-mono border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />

      <p className="text-xs text-gray-400">
        Edite se necessário, depois clique em <strong>Copiar texto</strong> e cole no Zenfisio.
        O carimbo do profissional e a assinatura digital ficam no Zenfisio.
      </p>
    </div>
  )
}
