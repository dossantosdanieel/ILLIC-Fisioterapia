import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { buscarSessaoTemplate } from '@/features/sessoes/api'
import { buscarPaciente } from '@/features/pacientes/api'
import { ExecutarSessao } from '@/features/sessoes/components/ExecutarSessao'
import { Spinner } from '@/components/ui/spinner'
import type { PacienteDetalhe } from '@/types/queries'

export default function ExecutarSessaoPage() {
  const { id, templateId } = useParams<{ id: string; templateId: string }>()
  const [searchParams] = useSearchParams()
  const planoId = searchParams.get('plano') ?? undefined

  const { data: template, isLoading: loadingT } = useQuery({
    queryKey: ['sessao-template', templateId],
    queryFn: () => buscarSessaoTemplate(templateId!),
    enabled: !!templateId,
  })

  const { data: pacienteRaw, isLoading: loadingP } = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => buscarPaciente(id!),
    enabled: !!id,
  })
  const paciente = pacienteRaw as PacienteDetalhe | undefined

  if (loadingT || loadingP) return <Spinner />
  if (!template || !paciente) return null

  const totalEx = template.bloco.flatMap(b => b.exercicio_prescrito).length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to={`/pacientes/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> {paciente.nome}
      </Link>

      <div className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Executar sessão</h1>
        <p className="text-sm text-gray-500">{paciente.nome} · {totalEx} exercícios prescritos</p>
      </div>

      {totalEx === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          Nenhum exercício prescrito nesta sessão. Monte a sessão primeiro no builder.
        </p>
      ) : (
        <ExecutarSessao template={template} pacienteId={id!} planoId={planoId} />
      )}
    </div>
  )
}
