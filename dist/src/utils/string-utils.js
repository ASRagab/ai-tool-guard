/**
 * String utility functions for fuzzy matching and suggestions.
 * @module utils/string-utils
 */
/**
 * Calculates the Levenshtein distance between two strings.
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string into another.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} The Levenshtein distance between the two strings
 *
 * @example
 * ```typescript
 * levenshteinDistance('kitten', 'sitting'); // Returns 3
 * levenshteinDistance('claude', 'claued'); // Returns 1
 * levenshteinDistance('copilot', 'copiot'); // Returns 1
 * ```
 */
export function levenshteinDistance(a, b) {
    // Normalize strings to lowercase for case-insensitive comparison
    const str1 = a.toLowerCase();
    const str2 = b.toLowerCase();
    const m = str1.length;
    const n = str2.length;
    // Create a 2D array to store distances
    const dp = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));
    // Initialize base cases
    for (let i = 0; i <= m; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }
    // Fill in the rest of the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            }
            else {
                dp[i][j] = Math.min(dp[i - 1][j] + 1, // deletion
                dp[i][j - 1] + 1, // insertion
                dp[i - 1][j - 1] + 1 // substitution
                );
            }
        }
    }
    return dp[m][n];
}
/**
 * Finds the closest matches to a target string from a list of candidates.
 * Uses Levenshtein distance to rank candidates by similarity.
 *
 * @param {string} target - The target string to match
 * @param {string[]} candidates - Array of candidate strings
 * @param {number} maxDistance - Maximum Levenshtein distance to consider (default: 3)
 * @param {number} maxSuggestions - Maximum number of suggestions to return (default: 3)
 * @returns {string[]} Array of closest matching strings, sorted by distance
 *
 * @example
 * ```typescript
 * const ecosystems = ['claude-code', 'github-copilot', 'opencode', 'codex', 'google-gemini'];
 * findClosestMatches('copiot', ecosystems); // Returns ['github-copilot', 'copilot']
 * findClosestMatches('claued', ecosystems); // Returns ['claude-code']
 * findClosestMatches('xyz', ecosystems); // Returns [] (no close matches)
 * ```
 */
export function findClosestMatches(target, candidates, maxDistance = 3, maxSuggestions = 3) {
    // Calculate distances for all candidates
    const distances = candidates.map(candidate => ({
        value: candidate,
        distance: levenshteinDistance(target, candidate)
    }));
    // Filter by max distance and sort by distance
    const matches = distances
        .filter(item => item.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxSuggestions)
        .map(item => item.value);
    return matches;
}
