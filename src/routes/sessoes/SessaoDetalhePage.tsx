import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { buscarSessaoRealizada, buscarSessaoTemplate } from '@/features/sessoes/api'
import { buscarPaciente } from '@/features/pacientes/api'
import { CopiarEvolucao } from '@/features/sessoes/components/CopiarEvolucao'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { formatarData } from '@/features/planos/utils'
import type { PacienteDetalhe } from '@/types/queries'

export default function SessaoDetalhePage() {
  const { id, sessaoId } = useParams<{ id: string; sessaoId: string }>()
  const [_searchParams] = useSearchParams()

  const { data: sessao, isLoading: loadingS } = useQuery({
    queryKey: ['sessao-realizada', sessaoId],
    queryFn: () => buscarSessaoRealizada(sessaoId!),
    enabled: !!sessaoId,
  })

  const { data: template, isLoading: loadingT } = useQuery({
    queryKey: ['sessao-template', sessao?.sessao_template_id],
    queryFn: () => buscarSessaoTemplate(sessao!.sessao_template_id),
    enabled: !!sessao?.sessao_template_id,
  })

  const { data: pacienteRaw, isLoading: loadingP } = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => buscarPaciente(id!),
    enabled: !!id,
  })
  const paciente = pacienteRaw as PacienteDetalhe | undefined

  if (loadingS || loadingT || loadingP) return <Spinner />
  if (!sessao || !template || !paciente) return null

  const realizados = sessao.execucao_exercicio.filter(e => e.realizado).length
  const total = sessao.execucao_exercicio.length
  const fidelidade = total > 0 ? Math.round((realizados / total) * 100) : 100

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to={`/pacientes/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> {paciente.nome}
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-lg font-semibold text-gray-900">
          Sessão — {formatarData(sessao.data)}
        </h1>
        <Badge variant={fidelidade === 100 ? 'success' : fidelidade >= 70 ? 'warning' : 'danger'}>
          {fidelidade}% fidelidade
        </Badge>
      </div>

      <CopiarEvolucao
        sessao={sessao}
        template={template}
        pacienteNome={paciente.nome}
        profissionalNome={paciente.profissional?.nome ?? ''}
        crefito={paciente.profissional?.crefito ?? null}
      />
    </div>
  )
}
