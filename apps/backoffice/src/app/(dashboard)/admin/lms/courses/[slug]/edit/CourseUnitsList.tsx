"use client";

import { Card, CardHeader, CardContent } from "@zephyra/ui";
import { readCourseUnits } from "@/features/lms/lib/sco-structure";

interface CourseUnitsListProps {
  scoStructure: unknown;
}

/**
 * CourseUnitsList — C-07. A read-only projection of scoStructure.organizations
 * .items, i.e. the SCORM package's own unit/module breakdown. Before this,
 * the edit page showed nothing derived from the package at all, so an admin
 * had no way to see what units a course actually contained.
 *
 * Deliberately a SEPARATE component from CourseMetaForm rather than a new
 * section grafted onto it. CourseMetaForm's own header comment states the
 * boundary — "SCORM payload fields are intentionally NOT exposed here —
 * those only change via re-ingest" — and this component's whole point is to
 * respect exactly that: no form state, no mutation, no input control, so the
 * read-only-ness is structural rather than a convention the next edit to
 * CourseMetaForm could accidentally erode. The package's units only change by
 * re-ingesting (see CourseMetaForm's "Estado" card, which already says so);
 * this list is what that re-ingest changes, and nothing here writes to it.
 *
 * The parsing itself lives in features/lms/lib/sco-structure.ts (pure
 * function, unit-tested there) — this component only renders its output.
 */
export function CourseUnitsList({ scoStructure }: CourseUnitsListProps) {
  const units = readCourseUnits(scoStructure);

  return (
    <Card padding="lg">
      <CardHeader
        title="Unidades del curso"
        description="Estructura del paquete SCORM. Sólo lectura — cambia únicamente reingestando el paquete."
      />
      <CardContent>
        {units.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
            El paquete SCORM de este curso no declara unidades identificables.
          </p>
        ) : (
          <ol
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {units.map((unit) => (
              <li key={unit.identifier} style={{ fontSize: 14, color: "var(--color-text)" }}>
                {unit.title}
                {unit.scormType && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    ({unit.scormType})
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
