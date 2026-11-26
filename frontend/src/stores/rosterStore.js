'use client';
import { create } from 'zustand';
import { runClientValidation, } from '@/lib/client-validator';
function recomputeValidation(state) {
    if (!state.rosterVersion)
        return null;
    return runClientValidation({
        monthKey: state.monthKey,
        baseShifts: state.rosterVersion.shiftEntries,
        pendingEdits: state.pendingEdits,
        employees: state.employees,
        rules: state.processRules,
        leaves: state.leaves,
        holidays: state.holidays,
    });
}
export const useRosterStore = create((set, get) => ({
    monthKey: '2026-11',
    loading: false,
    generating: false,
    simulating: false,
    committing: false,
    error: null,
    toast: null,
    rosterVersion: null,
    pods: [],
    employees: [],
    brands: [],
    processRules: [],
    allocations: [],
    leaves: [],
    holidays: [],
    lens: 'COMPANY',
    selectedPodId: 'ALL',
    selectedBrandId: 'ALL',
    selectedProcess: 'ALL',
    searchQuery: '',
    pendingEdits: {},
    undoStack: [],
    redoStack: [],
    clientValidation: null,
    unsatisfiableCore: null,
    spofItems: [],
    copilotOpen: false,
    copilotLoading: false,
    copilotExplanation: null,
    simulatorOpen: false,
    simulationResult: null,
    addEmployeeModalOpen: false,
    addBrandModalOpen: false,
    openAddEmployee: () => set({ addEmployeeModalOpen: true, addBrandModalOpen: false }),
    openAddBrand: () => set({ addBrandModalOpen: true, addEmployeeModalOpen: false }),
    closeEntityModals: () => set({ addEmployeeModalOpen: false, addBrandModalOpen: false }),
    setMonthKey: (monthKey) => set({ monthKey }),
    setLens: (lens) => set({ lens }),
    setSelectedPodId: (selectedPodId) => set({ selectedPodId }),
    setSelectedBrandId: (selectedBrandId) => set({ selectedBrandId }),
    setSelectedProcess: (selectedProcess) => set({ selectedProcess }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    clearToast: () => set({ toast: null }),
    showToast: (type, message) => set({ toast: { type, message } }),
    fetchRosterData: async (targetMonth) => {
        const monthKey = targetMonth || get().monthKey;
        set({ loading: true, error: null });
        try {
            const res = await fetch(`/api/roster/generate?monthKey=${encodeURIComponent(monthKey)}`);
            if (res.status === 404) {
                // No generated roster yet — still load entities & spof radar
                const [entRes, spofRes] = await Promise.all([
                    fetch('/api/entities?include=all'),
                    fetch(`/api/dashboard/spof?monthKey=${encodeURIComponent(monthKey)}`),
                ]);
                const entData = await entRes.json();
                const spofData = spofRes.ok ? await spofRes.json() : { spofAudit: [] };
                set({
                    monthKey,
                    rosterVersion: null,
                    pods: entData.pods || [],
                    employees: entData.employees || [],
                    brands: entData.brands || [],
                    processRules: entData.rules || [],
                    allocations: entData.allocations || [],
                    leaves: entData.leaves || [],
                    holidays: entData.holidays || [],
                    spofItems: spofData.spofAudit || [],
                    pendingEdits: {},
                    undoStack: [],
                    redoStack: [],
                    clientValidation: null,
                    loading: false,
                });
                return;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to load roster');
            }
            const data = await res.json();
            const spofRes = await fetch(`/api/dashboard/spof?monthKey=${encodeURIComponent(monthKey)}`);
            const spofData = spofRes.ok ? await spofRes.json() : { spofAudit: [] };
            const nextState = {
                monthKey,
                rosterVersion: data.rosterVersion,
                pods: data.pods || [],
                employees: data.employees || [],
                brands: data.brands || [],
                processRules: (data.processRules || []).map((r) => ({
                    ...r,
                    process: r.process,
                    operatingCalendar: r.operatingCalendar,
                })),
                allocations: data.allocations || [],
                leaves: data.leaves || [],
                holidays: data.holidays || [],
                spofItems: spofData.spofAudit || [],
                pendingEdits: {},
                undoStack: [],
                redoStack: [],
            };
            set({
                ...nextState,
                clientValidation: recomputeValidation(nextState),
                loading: false,
            });
        }
        catch (e) {
            set({
                loading: false,
                error: e instanceof Error ? e.message : 'Failed to fetch roster data',
            });
        }
    },
    generateRoster: async (targetMonth) => {
        const monthKey = targetMonth || get().monthKey;
        set({ generating: true, error: null, unsatisfiableCore: null });
        try {
            const res = await fetch('/api/roster/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monthKey, timeLimitSeconds: 120 }),
            });
            const data = await res.json();
            if (res.status === 422 || !data.success) {
                set({
                    generating: false,
                    unsatisfiableCore: data.unsatisfiable_core || [],
                    spofItems: data.spof_audit?.spof_items || get().spofItems,
                    toast: {
                        type: 'error',
                        message: 'CP-SAT Solver detected infeasibility — inspect conflict core or AI Copilot.',
                    },
                });
                return;
            }
            await get().fetchRosterData(monthKey);
            set({
                generating: false,
                toast: {
                    type: 'success',
                    message: `Solved ${data.totalShifts} shifts in ${data.solverDurationMs}ms (Objective: ${data.objectiveScore ?? 'feasible'})`,
                },
            });
        }
        catch (e) {
            set({
                generating: false,
                toast: {
                    type: 'error',
                    message: e instanceof Error ? e.message : 'Roster generation failed',
                },
            });
        }
    },
    stageEdit: (edit) => {
        const state = get();
        const key = `${edit.employeeId}:${edit.date}`;
        const nextPending = { ...state.pendingEdits, [key]: edit };
        const nextUndo = [...state.undoStack.slice(-49), state.pendingEdits];
        set({
            pendingEdits: nextPending,
            undoStack: nextUndo,
            redoStack: [],
            clientValidation: recomputeValidation({
                ...state,
                pendingEdits: nextPending,
            }),
        });
    },
    undoEdit: () => {
        const state = get();
        if (state.undoStack.length === 0)
            return;
        const prev = state.undoStack[state.undoStack.length - 1];
        const nextUndo = state.undoStack.slice(0, -1);
        const nextRedo = [...state.redoStack, state.pendingEdits];
        set({
            pendingEdits: prev,
            undoStack: nextUndo,
            redoStack: nextRedo,
            clientValidation: recomputeValidation({ ...state, pendingEdits: prev }),
        });
    },
    redoEdit: () => {
        const state = get();
        if (state.redoStack.length === 0)
            return;
        const next = state.redoStack[state.redoStack.length - 1];
        const nextRedo = state.redoStack.slice(0, -1);
        const nextUndo = [...state.undoStack, state.pendingEdits];
        set({
            pendingEdits: next,
            undoStack: nextUndo,
            redoStack: nextRedo,
            clientValidation: recomputeValidation({ ...state, pendingEdits: next }),
        });
    },
    discardEdits: () => {
        const state = get();
        set({
            pendingEdits: {},
            undoStack: [],
            redoStack: [],
            clientValidation: recomputeValidation({ ...state, pendingEdits: {} }),
        });
    },
    commitEdits: async (actorName = 'Operations Lead', forceUnlock = false) => {
        const state = get();
        if (!state.rosterVersion)
            return false;
        const edits = Object.values(state.pendingEdits);
        if (edits.length === 0)
            return true;
        set({ committing: true });
        try {
            const res = await fetch('/api/roster/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rosterVersionId: state.rosterVersion.id,
                    edits,
                    commit: true,
                    actorName,
                    forceUnlock,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                set({
                    committing: false,
                    toast: {
                        type: 'error',
                        message: data.error || data.message || 'Validation blocked commit',
                    },
                });
                return false;
            }
            await get().fetchRosterData(state.monthKey);
            set({
                committing: false,
                toast: {
                    type: 'success',
                    message: `Committed ${data.appliedEdits} shift override(s) with audit trail`,
                },
            });
            return true;
        }
        catch (e) {
            set({
                committing: false,
                toast: {
                    type: 'error',
                    message: e instanceof Error ? e.message : 'Commit failed',
                },
            });
            return false;
        }
    },
    togglePublish: async (action, actorName, notes) => {
        const state = get();
        if (!state.rosterVersion)
            return false;
        set({ committing: true });
        try {
            const res = await fetch('/api/roster/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rosterVersionId: state.rosterVersion.id,
                    action,
                    actorName,
                    notes,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                set({
                    committing: false,
                    toast: { type: 'error', message: data.error || 'Publish action failed' },
                });
                return false;
            }
            await get().fetchRosterData(state.monthKey);
            set({
                committing: false,
                toast: {
                    type: 'success',
                    message: action === 'PUBLISH' ? 'Roster locked & published for Pod Lead sign-off' : 'Roster unlocked back to DRAFT',
                },
            });
            return true;
        }
        catch (e) {
            set({
                committing: false,
                toast: { type: 'error', message: e instanceof Error ? e.message : 'Publish failed' },
            });
            return false;
        }
    },
    runSimulation: async (disruptionDate, disruptedEmployeeIds) => {
        const state = get();
        if (!state.rosterVersion)
            return;
        set({ simulating: true, simulatorOpen: true, simulationResult: null });
        try {
            const res = await fetch('/api/roster/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rosterVersionId: state.rosterVersion.id,
                    disruptionDate,
                    disruptedEmployeeIds,
                    commit: false,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                set({
                    simulating: false,
                    toast: { type: 'error', message: data.error || 'No feasible backup cascade found' },
                });
                return;
            }
            const empMap = new Map(state.employees.map((e) => [e.id, e.name]));
            set({
                simulating: false,
                simulationResult: {
                    disruptionDate,
                    disruptedEmployeeIds,
                    disruptedEmployeeNames: disruptedEmployeeIds.map((id) => empMap.get(id) || id),
                    backup_candidates: data.backup_candidates || [],
                    cascade_diff: data.cascade_diff || [],
                    perturbation_count: data.perturbation_count || 0,
                    solver_duration_ms: data.solver_duration_ms || 0,
                },
            });
        }
        catch (e) {
            set({
                simulating: false,
                toast: { type: 'error', message: e instanceof Error ? e.message : 'Simulation failed' },
            });
        }
    },
    commitSimulation: async (actorName = 'Operations Lead') => {
        const state = get();
        if (!state.rosterVersion || !state.simulationResult)
            return;
        set({ committing: true });
        try {
            const res = await fetch('/api/roster/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rosterVersionId: state.rosterVersion.id,
                    disruptionDate: state.simulationResult.disruptionDate,
                    disruptedEmployeeIds: state.simulationResult.disruptedEmployeeIds,
                    commit: true,
                    actorName,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                set({
                    committing: false,
                    toast: { type: 'error', message: data.error || 'Failed to apply reoptimized schedule' },
                });
                return;
            }
            await get().fetchRosterData(state.monthKey);
            set({
                committing: false,
                simulatorOpen: false,
                simulationResult: null,
                toast: {
                    type: 'success',
                    message: `Applied minimal-perturbation reoptimization (${data.perturbation_count} shift changes)`,
                },
            });
        }
        catch (e) {
            set({
                committing: false,
                toast: { type: 'error', message: e instanceof Error ? e.message : 'Commit failed' },
            });
        }
    },
    closeSimulator: () => set({ simulatorOpen: false, simulationResult: null }),
    openCopilot: async (payload) => {
        const state = get();
        set({ copilotOpen: true, copilotLoading: true });
        try {
            const res = await fetch('/api/ai/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monthKey: state.monthKey,
                    unsatisfiableCore: payload?.unsatisfiableCore ?? state.unsatisfiableCore ?? undefined,
                    spofItems: payload?.spofItems ?? state.spofItems,
                    violations: state.clientValidation?.violations,
                    context: payload?.context,
                }),
            });
            const data = await res.json();
            set({ copilotLoading: false, copilotExplanation: data });
        }
        catch {
            set({ copilotLoading: false });
        }
    },
    closeCopilot: () => set({ copilotOpen: false }),
}));
