import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/AuthContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import Layout from '@/routes/Layout'
import Login from '@/routes/Login'

// Fase 1
import PacientesPage from '@/routes/pacientes/PacientesPage'
import NovoPacientePage from '@/routes/pacientes/NovoPacientePage'
import PacienteDetalhePage from '@/routes/pacientes/PacienteDetalhePage'
import NovoPlanoPage from '@/routes/pacientes/NovoPlanoPage'
import PlanoDetalhePage from '@/routes/pacientes/PlanoDetalhePage'
import NovaAvaliacaoPage from '@/routes/pacientes/NovaAvaliacaoPage'
import AvaliacaoDetalhePage from '@/routes/pacientes/AvaliacaoDetalhePage'

// Fase 2
import SessoesPage from '@/routes/sessoes/SessoesPage'
import FaseDetalhePage from '@/routes/sessoes/FaseDetalhePage'
import ExecutarSessaoPage from '@/routes/sessoes/ExecutarSessaoPage'
import SessaoDetalhePage from '@/routes/sessoes/SessaoDetalhePage'

// Fase 3
import CheckInPage from '@/routes/pacientes/CheckInPage'
import CoordenacaoPage from '@/routes/coordenacao/CoordenacaoPage'
import PacienteCoordenacaoPage from '@/routes/coordenacao/PacienteCoordenacaoPage'

// Fase 4
import PerformancePage from '@/routes/performance/PerformancePage'

// Admin
import AdminPage from '@/routes/admin/AdminPage'

// Protocolos
import ProtocolosPage from '@/routes/protocolos/ProtocolosPage'
import ProtocoloDetalhePage from '@/routes/protocolos/ProtocoloDetalhePage'
import NovoProtocoloPage from '@/routes/protocolos/NovoProtocoloPage'
import EditarProtocoloPage from '@/routes/protocolos/EditarProtocoloPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2, retry: 1 } },
})


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/pacientes" replace />} />

              {/* ── Pacientes ── */}
              <Route path="pacientes" element={<PacientesPage />} />
              <Route path="pacientes/novo" element={<NovoPacientePage />} />
              <Route path="pacientes/:id" element={<PacienteDetalhePage />} />
              <Route path="pacientes/:id/plano/novo" element={<NovoPlanoPage />} />
              <Route path="pacientes/:id/plano/:planoId" element={<PlanoDetalhePage />} />
              <Route path="pacientes/:id/avaliacoes/nova" element={<NovaAvaliacaoPage />} />
              <Route path="pacientes/:id/avaliacoes/:avaliacaoId" element={<AvaliacaoDetalhePage />} />
              <Route path="pacientes/:id/checkin" element={<CheckInPage />} />

              {/* ── Sessões ── */}
              <Route path="pacientes/:id/plano/:planoId/fase/:faseId" element={<FaseDetalhePage />} />
              <Route path="pacientes/:id/sessoes/executar/:templateId" element={<ExecutarSessaoPage />} />
              <Route path="pacientes/:id/sessoes/:sessaoId" element={<SessaoDetalhePage />} />
              <Route path="sessoes" element={<SessoesPage />} />

              {/* ── Coordenação ── */}
              <Route path="coordenacao" element={
                <ProtectedRoute minPapel="coordenador"><CoordenacaoPage /></ProtectedRoute>
              } />
              <Route path="coordenacao/paciente/:id" element={
                <ProtectedRoute minPapel="coordenador"><PacienteCoordenacaoPage /></ProtectedRoute>
              } />

              {/* ── Placeholders ── */}
              <Route path="avaliacoes" element={<Navigate to="/pacientes" replace />} />
              <Route path="performance" element={
                <ProtectedRoute minPapel="coordenador"><PerformancePage /></ProtectedRoute>
              } />
              {/* ── Protocolos ── */}
              <Route path="protocolos" element={<ProtocolosPage />} />
              <Route path="protocolos/novo" element={
                <ProtectedRoute minPapel="coordenador"><NovoProtocoloPage /></ProtectedRoute>
              } />
              <Route path="protocolos/:id" element={<ProtocoloDetalhePage />} />
              <Route path="protocolos/:id/editar" element={
                <ProtectedRoute minPapel="coordenador"><EditarProtocoloPage /></ProtectedRoute>
              } />

              <Route path="admin" element={
                <ProtectedRoute minPapel="admin"><AdminPage /></ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
