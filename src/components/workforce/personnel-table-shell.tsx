"use client";

import { useMemo, useState, useEffect } from "react";
import { PersonnelTable } from "./personnel-table";
import { PersonForm } from "./person-form";
import type {
  PersonnelWithRole,
  AssignmentRollup,
  LaborRole,
  PersonWeekAssignment,
} from "@/lib/types/workforce";

type Props = {
  tenantId: string;
  personnel: PersonnelWithRole[];
  rollups: AssignmentRollup[];
  laborRoles: LaborRole[];
};

const actionBtnClass =
  "rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10";

const ghostBtnClass =
  "rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white";

export function PersonnelTableShellClient({
  tenantId,
  personnel,
  rollups,
  laborRoles,
}: Props) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonnelWithRole[]>(personnel);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [personWeeks, setPersonWeeks] = useState<PersonWeekAssignment[]>([]);

  const selectedPerson = useMemo(() => {
    if (!selectedPersonId) return null;
    return people.find((person) => person.id === selectedPersonId) ?? null;
  }, [people, selectedPersonId]);

  useEffect(() => {
    if (!selectedPersonId) {
      setPersonWeeks([]);
      return;
    }

    async function loadWeeks() {
      const res = await fetch(
        `/api/workforce/personnel/${selectedPersonId}/weeks?tenantId=${tenantId}`,
      );

      if (!res.ok) {
        setPersonWeeks([]);
        return;
      }

      const data = await res.json();
      setPersonWeeks(data);
    }

    loadWeeks();
  }, [selectedPersonId, tenantId]);

  function handleSelectPerson(personId: string) {
    setSelectedPersonId(personId);
    setIsDetailModalOpen(true);
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className={actionBtnClass}
          >
            Add Person
          </button>
        </div>

        <div className="min-w-0">
          <PersonnelTable
            personnel={people}
            rollups={rollups}
            laborRoles={laborRoles}
            onSelectPerson={handleSelectPerson}
            selectedPersonId={selectedPersonId}
          />
        </div>
      </div>

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add Person</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className={ghostBtnClass}
              >
                Close
              </button>
            </div>

            <PersonForm
              laborRoles={laborRoles}
              editTarget={null}
              tenantId={tenantId}
              onSuccess={(createdPerson) => {
                const matchedRole =
                  laborRoles.find(
                    (role) => role.id === createdPerson.labor_role_id,
                  ) ?? null;

                const personWithRole: PersonnelWithRole = {
                  ...createdPerson,
                  labor_roles: matchedRole,
                };

                setPeople((prev) => [personWithRole, ...prev]);
                setSelectedPersonId(createdPerson.id);
                setIsAddModalOpen(false);
              }}
              onCancel={() => setIsAddModalOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {isDetailModalOpen && selectedPerson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Person Details
              </h2>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className={ghostBtnClass}
              >
                Close
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-zinc-400">Full Name</div>
                <div className="text-white">{selectedPerson.full_name}</div>
              </div>

              <div>
                <div className="text-zinc-400">Role</div>
                <div className="text-white">
                  {selectedPerson.labor_roles?.name ?? "Unassigned"}
                </div>
              </div>

              <div>
                <div className="text-zinc-400">Status</div>
                <div className="text-white">
                  {selectedPerson.active ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="pt-2">
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
                  Next 12 Weeks
                </div>

                {personWeeks.length === 0 ? (
                  <div className="text-sm text-zinc-500">
                    No assignments scheduled
                  </div>
                ) : (
                  <div className="space-y-2">
                    {personWeeks.map((week) => (
                      <div
                        key={week.week_start_date}
                        className="rounded-md border border-white/10 p-3"
                      >
                        <div className="text-xs text-zinc-400">
                          {new Date(week.week_start_date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-white">
                          {week.project_name ?? "Unassigned"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {week.schedule_task_name ?? ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
