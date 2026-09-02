import { Check, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { SmokeCheckResult } from '../core/smokeChecks';

export function QualityPanel({ checks }: { checks: SmokeCheckResult[] }) {
  const passed = checks.filter((check) => check.passed).length;
  return (
    <section className="quality panel">
      <div className="panelHeader">
        <h2><ShieldCheck size={18} />Algorithm QA</h2>
        <span className="status">{passed}/{checks.length} passed</span>
      </div>
      <div className="qualityGrid">
        {checks.map((check) => (
          <div className={`qualityItem ${check.passed ? 'pass' : 'fail'}`} key={check.method}>
            {check.passed ? <Check size={15} /> : <TriangleAlert size={15} />}
            <strong>{check.method}</strong>
            <span>{check.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
