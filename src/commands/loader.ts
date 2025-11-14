/**
 * Slash Command Loader
 * Loads and validates slash command definitions from a directory
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandCollection, SlashCommand } from './types.js';

/**
 * Load slash commands from a directory
 *
 * Command files should be JSON or Markdown files with the following structure:
 * - JSON: Direct SlashCommand object
 * - Markdown: Frontmatter with command metadata + instructions in body
 *
 * @param commandsPath - Path to directory containing command definitions
 * @returns Loaded command collection
 */
export function loadSlashCommands(commandsPath: string): CommandCollection {
  try {
    // Verify directory exists
    const stat = statSync(commandsPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${commandsPath}`);
    }

    // Read all files in directory
    const files = readdirSync(commandsPath);
    const commands: SlashCommand[] = [];

    for (const file of files) {
      const filePath = join(commandsPath, file);
      const fileExt = file.split('.').pop()?.toLowerCase();

      try {
        let command: SlashCommand | null = null;

        if (fileExt === 'json') {
          // Load JSON command definition
          const content = readFileSync(filePath, 'utf-8');
          command = JSON.parse(content) as SlashCommand;
        } else if (fileExt === 'md' || fileExt === 'markdown') {
          // Load Markdown command definition (with frontmatter)
          command = parseMarkdownCommand(filePath);
        } else {
          // Skip unsupported file types
          continue;
        }

        if (command) {
          // Validate command structure
          validateCommand(command);
          commands.push(command);
        }
      } catch (error) {
        console.warn(
          `Warning: Failed to load command from ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      commands,
      count: commands.length,
      source: commandsPath,
    };
  } catch (error) {
    throw new Error(
      `Failed to load slash commands from ${commandsPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Parse markdown file with frontmatter as command definition
 */
function parseMarkdownCommand(filePath: string): SlashCommand | null {
  const content = readFileSync(filePath, 'utf-8');

  // Simple frontmatter parser (expects YAML between --- delimiters)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new Error('Markdown file must contain frontmatter with command metadata');
  }

  const [, frontmatter, body] = frontmatterMatch;

  // Parse frontmatter (simple key: value parser)
  const metadata: Record<string, any> = {};
  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      // Try to parse as JSON for arrays/objects, otherwise use as string
      try {
        metadata[key] = JSON.parse(value);
      } catch {
        metadata[key] = value.trim();
      }
    }
  }

  return {
    name: metadata.name,
    description: metadata.description,
    instructions: body.trim(),
    parameters: metadata.parameters,
    examples: metadata.examples,
  };
}

/**
 * Validate command structure
 */
function validateCommand(command: SlashCommand): void {
  if (!command.name || typeof command.name !== 'string') {
    throw new Error('Command must have a valid name');
  }

  if (!command.description || typeof command.description !== 'string') {
    throw new Error(`Command '${command.name}' must have a description`);
  }

  if (!command.instructions || typeof command.instructions !== 'string') {
    throw new Error(`Command '${command.name}' must have instructions`);
  }

  // Validate command name format (alphanumeric, hyphens, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(command.name)) {
    throw new Error(`Command name '${command.name}' contains invalid characters`);
  }
}

/**
 * Format commands for inclusion in system prompt
 */
export function formatCommandsForPrompt(collection: CommandCollection): string {
  if (collection.count === 0) {
    return '';
  }

  const parts: string[] = [];

  parts.push('## Available Slash Commands');
  parts.push('');
  parts.push('The following slash commands are available for use in your analysis:');
  parts.push('');

  for (const cmd of collection.commands) {
    parts.push(`### /${cmd.name}`);
    parts.push(`**Description:** ${cmd.description}`);
    parts.push('');
    parts.push('**Instructions:**');
    parts.push(cmd.instructions);
    parts.push('');

    if (cmd.parameters && cmd.parameters.length > 0) {
      parts.push('**Parameters:**');
      for (const param of cmd.parameters) {
        const required = param.required ? '(required)' : '(optional)';
        const defaultVal = param.default !== undefined ? ` [default: ${param.default}]` : '';
        parts.push(`- \`${param.name}\` ${required}${defaultVal}: ${param.description}`);
      }
      parts.push('');
    }

    if (cmd.examples && cmd.examples.length > 0) {
      parts.push('**Examples:**');
      for (const example of cmd.examples) {
        parts.push(`- ${example}`);
      }
      parts.push('');
    }

    parts.push('---');
    parts.push('');
  }

  return parts.join('\n');
}
