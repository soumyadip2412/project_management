import { Check, X } from "lucide-react";
import { CAPABILITY_ROWS, ROLE_COLUMNS } from "../../lib/landingRoles";
import { Container, SectionHeading } from "./shared";

/**
 * FILE: frontend/src/components/landing/RolesSection.jsx   (#roles)
 * The project-role table. Its data (lib/landingRoles.js) is checked against the
 * backend permission matrix by backend/tests/landingRoles.test.js.
 */
export default function RolesSection() {
  return (
    <section id="roles" aria-labelledby="roles-title" className="scroll-mt-16 bg-bg py-16 sm:py-24">
      <Container>
        <SectionHeading id="roles-title" eyebrow="Roles" title="Every role sees the right controls">
          Each project member has one role, and the API checks it on every request, whatever the interface shows. A test
          keeps this table in step with the server&apos;s permission matrix.
        </SectionHeading>

        <div
          role="region"
          aria-labelledby="roles-caption"
          tabIndex={0}
          className="relative mt-10 hidden overflow-x-auto rounded-md border border-line bg-surface md:block"
        >
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <caption id="roles-caption" className="sr-only">
              What each project role can do
            </caption>
            <thead>
              <tr className="border-b border-line bg-surface-raised">
                <th scope="col" className="px-4 py-3 text-xs font-semibold text-subtle">
                  Capability
                </th>
                {ROLE_COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="px-3 py-3 text-center text-xs font-semibold text-text">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-medium text-text">
                    {row.label}
                  </th>
                  {ROLE_COLUMNS.map((c) => {
                    const yes = row.allowed.includes(c.key);
                    const Icon = yes ? Check : X;
                    return (
                      <td key={c.key} className="px-3 py-3 text-center">
                        <Icon
                          size={16}
                          strokeWidth={yes ? 2.5 : 2}
                          aria-hidden="true"
                          className={yes ? "inline text-success" : "inline text-subtlest"}
                        />
                        <span className="sr-only">{yes ? "Yes" : "No"}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phones: six columns do not fit, so the same data reads as a list. */}
        <ul aria-label="What each project role can do" className="mt-8 divide-y divide-line rounded-md border border-line bg-surface md:hidden">
          {CAPABILITY_ROWS.map((row) => (
            <li key={row.label} className="px-4 py-3">
              <p className="text-sm font-medium text-text">{row.label}</p>
              <p className="mt-0.5 flex items-start gap-1.5 text-[13px] text-subtle">
                <Check size={14} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
                {row.allowed.length === ROLE_COLUMNS.length
                  ? "Every role"
                  : ROLE_COLUMNS.filter((c) => row.allowed.includes(c.key)).map((c) => c.label).join(", ")}
              </p>
            </li>
          ))}
        </ul>

        <ul className="mt-4 space-y-1 text-[13px] text-subtle">
          <li>Client and Viewer are read-only apart from commenting, and cannot edit or delete comments.</li>
          <li>Comments are edited only by their author; project managers and scrum masters can also delete other people&apos;s.</li>
          <li>Only a project&apos;s owner can delete the project. Team lead has the same permissions as Scrum master.</li>
        </ul>
      </Container>
    </section>
  );
}
