/**
 * Slash Command Type Definitions
 */

/**
 * Slash command definition
 * These commands can be invoked in user prompts to provide structured capabilities
 */
export interface SlashCommand {
  /** Command name (without the slash prefix) */
  name: string;

  /** Short description of what the command does */
  description: string;

  /** Detailed instructions for the AI on how to execute this command */
  instructions: string;

  /** Optional parameters the command accepts */
  parameters?: CommandParameter[];

  /** Optional examples showing command usage */
  examples?: string[];
}

/**
 * Command parameter definition
 */
export interface CommandParameter {
  /** Parameter name */
  name: string;

  /** Parameter description */
  description: string;

  /** Whether the parameter is required */
  required: boolean;

  /** Parameter type */
  type: 'string' | 'number' | 'boolean';

  /** Default value if not provided */
  default?: string | number | boolean;
}

/**
 * Loaded command collection
 */
export interface CommandCollection {
  commands: SlashCommand[];
  count: number;
  source: string;
}
