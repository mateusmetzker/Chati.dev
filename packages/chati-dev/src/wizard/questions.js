import * as p from '@clack/prompts';
import { t, SUPPORTED_LANGUAGES, loadLanguage } from './i18n.js';
import { detectProjectType } from '../utils/detector.js';
import { showSummary, showChecklist } from './feedback.js';
import { brand, dim, success } from '../utils/colors.js';

/**
 * Step 1: Language Selection (always in English)
 */
export async function stepLanguage() {
  const language = await p.select({
    message: 'Select your language:',
    options: SUPPORTED_LANGUAGES.map(lang => ({
      value: lang.value,
      label: lang.label,
    })),
  });

  if (p.isCancel(language)) {
    p.cancel('Installation cancelled.');
    process.exit(0);
  }

  // Load i18n strings from this point forward
  loadLanguage(language);

  return language;
}

/**
 * Step 2: Project Type
 */
export async function stepProjectType(targetDir) {
  const detection = detectProjectType(targetDir);

  if (detection.suggestion === 'brownfield' && detection.confidence !== 'low') {
    p.note(
      `${success('✓')} ${t('installer.detected_brownfield')}\n${t('installer.suggestion_brownfield')}`,
      dim('Auto-detection')
    );
  }

  const projectType = await p.select({
    message: t('installer.project_type'),
    options: [
      { value: 'greenfield', label: t('installer.greenfield') },
      { value: 'brownfield', label: t('installer.brownfield') },
    ],
    initialValue: detection.suggestion,
  });

  if (p.isCancel(projectType)) {
    p.cancel('Installation cancelled.');
    process.exit(0);
  }

  return projectType;
}

/**
 * Step 3: Confirmation
 */
export async function stepConfirmation(config) {
  const { projectName, projectType, language, selectedMCPs } = config;

  const langName = SUPPORTED_LANGUAGES.find(l => l.value === language)?.label || language;
  const ideNames = 'Claude Code (auto-configured)';
  const mcpNames = selectedMCPs.length > 0
    ? `${selectedMCPs.join(', ')} (auto-installed)`
    : 'None';

  console.log();
  console.log(brand(t('installer.confirmation_title') + ':'));
  showSummary({
    [t('installer.project_label')]: `${projectName} (${projectType === 'greenfield' ? 'Greenfield' : 'Brownfield'})`,
    [t('installer.language_label')]: langName,
    [t('installer.ides_label')]: ideNames,
    [t('installer.mcps_label')]: mcpNames,
  });

  console.log();
  console.log(`  ${t('installer.will_install')}:`);
  showChecklist([
    t('installer.agents_count'),
    t('installer.workflows_count'),
    t('installer.templates_count'),
    t('installer.constitution'),
    t('installer.session_mgmt'),
    t('installer.quality_gates'),
  ]);

  console.log();
  console.log(`  ${dim('Target:')} ${config.targetDir}`);

  const proceed = await p.confirm({
    message: t('installer.proceed'),
    initialValue: true,
  });

  if (p.isCancel(proceed) || !proceed) {
    p.cancel('Installation cancelled.');
    process.exit(0);
  }

  return true;
}
