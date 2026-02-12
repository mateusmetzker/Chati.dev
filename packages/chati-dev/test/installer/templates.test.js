import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import yaml from 'js-yaml';
import { generateSessionYaml, generateConfigYaml, generateClaudeMd } from '../../src/installer/templates.js';

const testConfig = {
  projectName: 'test-project',
  projectType: 'greenfield',
  language: 'en',
  selectedIDEs: ['claude-code'],
  selectedMCPs: ['browser', 'context7'],
  version: '1.2.1',
};

describe('generateSessionYaml', () => {
  it('generates valid YAML', () => {
    const result = generateSessionYaml(testConfig);
    const parsed = yaml.load(result);
    assert.ok(parsed, 'should parse as YAML');
  });

  it('includes project info', () => {
    const parsed = yaml.load(generateSessionYaml(testConfig));
    assert.equal(parsed.project.name, 'test-project');
    assert.equal(parsed.project.type, 'greenfield');
    assert.equal(parsed.project.state, 'clarity');
  });

  it('initializes all 12 agents', () => {
    const parsed = yaml.load(generateSessionYaml(testConfig));
    const agents = Object.keys(parsed.agents);
    assert.equal(agents.length, 12);
    assert.ok(agents.includes('brief'));
    assert.ok(agents.includes('dev'));
    assert.ok(agents.includes('devops'));
  });

  it('sets all agents to pending status', () => {
    const parsed = yaml.load(generateSessionYaml(testConfig));
    for (const agent of Object.values(parsed.agents)) {
      assert.equal(agent.status, 'pending');
      assert.equal(agent.score, 0);
    }
  });

  it('includes selected IDEs and MCPs', () => {
    const parsed = yaml.load(generateSessionYaml(testConfig));
    assert.deepEqual(parsed.ides, ['claude-code']);
    assert.deepEqual(parsed.mcps, ['browser', 'context7']);
  });
});

describe('generateConfigYaml', () => {
  it('generates valid YAML', () => {
    const result = generateConfigYaml(testConfig);
    const parsed = yaml.load(result);
    assert.ok(parsed);
  });

  it('includes version', () => {
    const parsed = yaml.load(generateConfigYaml(testConfig));
    assert.equal(parsed.version, '1.2.1');
  });

  it('includes timestamps', () => {
    const parsed = yaml.load(generateConfigYaml(testConfig));
    assert.ok(parsed.installed_at);
    assert.ok(parsed.updated_at);
  });
});

describe('generateClaudeMd', () => {
  it('includes project name', () => {
    const result = generateClaudeMd(testConfig);
    assert.ok(result.includes('test-project'));
  });

  it('includes session lock block', () => {
    const result = generateClaudeMd(testConfig);
    assert.ok(result.includes('SESSION-LOCK:INACTIVE'));
  });

  it('includes pipeline info', () => {
    const result = generateClaudeMd(testConfig);
    assert.ok(result.includes('CLARITY'));
    assert.ok(result.includes('DEPLOY'));
  });

  it('includes project type', () => {
    const result = generateClaudeMd(testConfig);
    assert.ok(result.includes('Greenfield'));
  });
});
