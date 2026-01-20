/**
 * Base detector interfaces for AI tool detection system.
 * Provides consistent contracts for all detector implementations.
 * @module detectors/base-detector
 */

/**
 * Information about a detected AI tool component.
 *
 * @interface ComponentInfo
 * @property {string} name - The name of the detected component (e.g., "claude-cli", "cursor")
 * @property {string} path - The absolute or relative file system path to the component
 * @property {string} [type] - Optional type classification of the component (e.g., "binary", "package", "extension")
 *
 * @example
 * ```typescript
 * const component: ComponentInfo = {
 *   name: "claude-cli",
 *   path: "/usr/local/bin/claude",
 *   type: "binary"
 * };
 * ```
 */
export interface ComponentInfo {
  /** The name of the detected component */
  name: string;

  /** The file system path to the component */
  path: string;

  /** Optional type classification (e.g., "binary", "package", "extension") */
  type?: string;
}

/**
 * Result of a detection scan operation.
 *
 * @interface DetectionResult
 * @property {string} ecosystem - The ecosystem or platform being scanned (e.g., "anthropic", "openai", "vscode")
 * @property {boolean} found - Whether any components were detected in this ecosystem
 * @property {Record<string, ComponentInfo>} components - Map of component identifiers to their detailed information
 * @property {string[]} scanPaths - List of file system paths that were scanned during detection
 *
 * @example
 * ```typescript
 * const result: DetectionResult = {
 *   ecosystem: "anthropic",
 *   found: true,
 *   components: {
 *     "claude-cli": {
 *       name: "claude-cli",
 *       path: "/usr/local/bin/claude",
 *       type: "binary"
 *     }
 *   },
 *   scanPaths: ["/usr/local/bin", "/usr/bin"]
 * };
 * ```
 */
export interface DetectionResult {
  /** The ecosystem or platform being scanned */
  ecosystem: string;

  /** Whether any components were detected */
  found: boolean;

  /** Map of detected components by identifier */
  components: Record<string, ComponentInfo>;

  /** Paths that were scanned during detection */
  scanPaths: string[];
}

/**
 * Base interface for AI tool detectors.
 * All detector implementations must conform to this contract.
 *
 * @interface AIToolDetector
 * @property {string} name - Unique identifier for this detector (e.g., "anthropic-detector", "openai-detector")
 *
 * @example
 * ```typescript
 * class AnthropicDetector implements AIToolDetector {
 *   readonly name = "anthropic-detector";
 *
 *   async detect(): Promise<DetectionResult> {
 *     // Implementation
 *   }
 *
 *   getPaths(): string[] {
 *     // Implementation
 *   }
 *
 *   async checkPATH(): Promise<ComponentInfo[]> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export interface AIToolDetector {
  /** Unique identifier for this detector */
  readonly name: string;

  /**
   * Performs a comprehensive detection scan for AI tools in this ecosystem.
   *
   * @returns {Promise<DetectionResult>} Promise resolving to the detection results
   * @throws {Error} If the detection process encounters an unrecoverable error
   *
   * @example
   * ```typescript
   * const detector = new AnthropicDetector();
   * const result = await detector.detect();
   * if (result.found) {
   *   console.log(`Found ${Object.keys(result.components).length} components`);
   * }
   * ```
   */
  detect(): Promise<DetectionResult>;

  /**
   * Returns a list of file system paths that this detector will scan.
   * Useful for understanding the detector's search scope before running detection.
   *
   * @returns {string[]} Array of absolute or relative paths to scan
   *
   * @example
   * ```typescript
   * const detector = new AnthropicDetector();
   * const paths = detector.getPaths();
   * console.log(`Will scan: ${paths.join(', ')}`);
   * ```
   */
  getPaths(): string[];

  /**
   * Checks the system PATH environment variable for AI tool executables.
   * This is a lighter-weight alternative to full detection when you only
   * need to check for installed command-line tools.
   *
   * @returns {Promise<ComponentInfo[]>} Promise resolving to array of found executables in PATH
   *
   * @example
   * ```typescript
   * const detector = new AnthropicDetector();
   * const pathComponents = await detector.checkPATH();
   * pathComponents.forEach(comp => {
   *   console.log(`Found ${comp.name} at ${comp.path}`);
   * });
   * ```
   */
  checkPATH(): Promise<ComponentInfo[]>;
}
