import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/AuthContext'
import { registrarCheckin, semanaISO, buscarCheckinSemana } from '../api'
import { Spinner } from '@/components/ui/spinner'
import type { TrajetoriaCaso, ConfiancaPrognostico, AderenciaPaciente } from '@/types/database'

interface Props { pacienteId: string; pacienteNome?: string } // eslint-disable-line @typescript-eslint/no-unused-vars

function OpcaoBtn<T extends string>({
  value, atual, label, cor, onSelect,
}: { value: T; atual: T; label: string; cor: string; onSelect: (v: T) => void }) {
  const selecionado = value === atual
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md border-2 transition-all ${
        selecionado ? `${cor} border-current` : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
      }`}
    >
      {label}
    </button>
  )
}

export function CheckInForm({ pacienteId }: Props) {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const { semana, ano } = semanaISO()

  const { data: existente, isLoading } = useQuery({
    queryKey: ['checkin', pacienteId, semana, ano],
    queryFn: () => buscarCheckinSemana(pacienteId, semana, ano),
  })

  const [trajetoria, setTrajetoria] = useState<TrajetoriaCaso>(
    (existente?.trajetoria as TrajetoriaCaso) ?? 'estavel',
  )
  const [confianca, setConfianca] = useState<ConfiancaPrognostico>(
    (existente?.confianca as ConfiancaPrognostico) ?? 'no_caminho',
  )
  const [aderencia, setAderencia] = useState<AderenciaPaciente>(
    (existente?.aderencia as AderenciaPaciente) ?? 'boa',
  )
  const [sinalAlerta, setSinalAlerta] = useState(existente?.sinal_alerta ?? '')
  const [precisaDiscutir, setPrecisaDiscutir] = useState(existente?.precisa_discutir ?? false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (isLoading) return <Spinner />

  const temAlerta = trajetoria === 'piorando' || confianca === 'preciso_rever' || confianca === 'em_risco' || precisaDiscutir

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profissional) return
    setErro(null)
    setLoading(true)
    try {
      await registrarCheckin({
        paciente_id: pacienteId,
        profissional_id: profissional.id,
        semana,
        ano,
        data: new Date().toISOString().split('T')[0],
        trajetoria,
        confianca,
        aderencia,
        sinal_alerta: sinalAlerta || null,
        precisa_discutir: precisaDiscutir,
      })
      navigate(`/pacientes/${pacienteId}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {existente && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
          Já existe um check-in para a semana {semana}/{ano}. Salvar irá substituí-lo.
        </div>
      )}

      {/* Trajetória */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Trajetória do caso vs. esperado
        </label>
        <div className="flex gap-2">
          <OpcaoBtn value="melhorando" atual={trajetoria}
            label="↑ Melhorando" cor="text-green-700 bg-green-50" onSelect={setTrajetoria} />
          <OpcaoBtn value="estavel" atual={trajetoria}
            label="→ Estável" cor="text-blue-700 bg-blue-50" onSelect={setTrajetoria} />
          <OpcaoBtn value="piorando" atual={trajetoria}
            label="↓ Piorando" cor="text-red-700 bg-red-50" onSelect={setTrajetoria} />
        </div>
      </div>

      {/* Confiança no prognóstico */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Confiança no prognóstico
        </label>
        <div className="flex gap-2">
          <OpcaoBtn value="no_caminho" atual={confianca}
            label="✓ No caminho" cor="text-green-700 bg-green-50" onSelect={setConfianca} />
          <OpcaoBtn value="em_risco" atual={confianca}
            label="⚠ Em risco" cor="text-amber-700 bg-amber-50" onSelect={setConfianca} />
          <OpcaoBtn value="preciso_rever" atual={confianca}
            label="✗ Preciso rever" cor="text-red-700 bg-red-50" onSelect={setConfianca} />
        </div>
      </div>

      {/* Aderência */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Aderência do paciente
        </label>
        <div className="flex gap-2">
          <OpcaoBtn value="boa" atual={aderencia}
            label="Boa" cor="text-green-700 bg-green-50" onSelect={setAderencia} />
          <OpcaoBtn value="parcial" atual={aderencia}
            label="Parcial" cor="text-amber-700 bg-amber-50" onSelect={setAderencia} />
          <OpcaoBtn value="baixa" atual={aderencia}
            label="Baixa" cor="text-red-700 bg-red-50" onSelect={setAderencia} />
        </div>
      </div>

      {/* Sinal de alerta */}
      <Textarea
        label="Sinal de alerta clínico (opcional)"
        placeholder="Descreva brevemente qualquer sinal relevante…"
        value={sinalAlerta}
        onChange={e => setSinalAlerta(e.target.value)}
        rows={2}
      />

      {/* Precisa discutir */}
      <div className={`flex items-center gap-3 p-3 rounded-md border-2 transition-colors cursor-pointer ${
        precisaDiscutir ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
      }`} onClick={() => setPrecisaDiscutir(!precisaDiscutir)}>
        <input
          type="checkbox"
          checked={precisaDiscutir}
          onChange={e => setPrecisaDiscutir(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-orange-600"
        />
        <div>
          <p className="text-sm font-medium text-gray-800">Precisa discutir com o coordenador</p>
          <p className="text-xs text-gray-500">Marque para elevar este caso na lista de atenção</p>
        </div>
      </div>

      {/* Alerta de elevação */}
      {temAlerta && (
        <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs font-medium text-red-700">
            ⚠ Este paciente será elevado para atenção prioritária no painel do coordenador.
          </p>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>
          Registrar check-in — Sem. {semana}/{ano}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
