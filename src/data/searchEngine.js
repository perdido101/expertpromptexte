// ExpertPrompt - Search Engine Module
// Handles fuzzy matching, synonyms, and role suggestions

import { ROLE_DATABASE, ROLE_SYNONYMS, AMBIGUOUS_ROLES } from './roles.js';

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score (0-1) based on Levenshtein distance
 */
function getSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Check if query matches the start of a string
 */
function startsWithMatch(query, target) {
  return target.toLowerCase().startsWith(query.toLowerCase());
}

/**
 * Check if query is contained in target
 */
function containsMatch(query, target) {
  return target.toLowerCase().includes(query.toLowerCase());
}

/**
 * Search for roles matching the query
 * Returns an array of matching roles with scores
 *
 * @param {string} query - The search query
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Array} - Array of { key, name, description, score, isAmbiguous, disambiguations }
 */
export function searchRoles(query, maxResults = 5) {
  if (!query || query.length < 2) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const results = [];
  const seenKeys = new Set();

  // Check for multi-role query
  const isMultiRole = /\s*[+&]\s*/.test(normalizedQuery) || /\s+and\s+/i.test(normalizedQuery);
  if (isMultiRole) {
    const parts = normalizedQuery.split(/\s*[+&]\s*|\s+and\s+/i).map(p => p.trim()).filter(p => p);
    const validParts = parts.filter(p => {
      const resolvedKey = ROLE_SYNONYMS[p] || p;
      return ROLE_DATABASE[resolvedKey];
    });

    if (validParts.length >= 2) {
      const combinedName = parts.map(p => {
        const resolvedKey = ROLE_SYNONYMS[p] || p;
        const role = ROLE_DATABASE[resolvedKey];
        return role ? role.name : p.charAt(0).toUpperCase() + p.slice(1);
      }).join(' + ');

      results.push({
        key: normalizedQuery,
        name: combinedName,
        description: 'combined expertise',
        score: 1,
        isMultiRole: true
      });
    }
  }

  // 1. Check for exact synonym match
  if (ROLE_SYNONYMS[normalizedQuery]) {
    const roleKey = ROLE_SYNONYMS[normalizedQuery];
    const role = ROLE_DATABASE[roleKey];
    if (role && !seenKeys.has(roleKey)) {
      seenKeys.add(roleKey);
      results.push({
        key: roleKey,
        name: role.name,
        description: role.description,
        score: 0.99, // High but not perfect (reserved for exact match)
        isAmbiguous: false
      });
    }
  }

  // 2. Check for ambiguous role
  if (AMBIGUOUS_ROLES[normalizedQuery]) {
    results.push({
      key: normalizedQuery,
      name: normalizedQuery.charAt(0).toUpperCase() + normalizedQuery.slice(1),
      description: 'multiple specializations available',
      score: 0.98,
      isAmbiguous: true,
      disambiguations: AMBIGUOUS_ROLES[normalizedQuery]
    });
  }

  // 3. Check for exact database match
  if (ROLE_DATABASE[normalizedQuery] && !seenKeys.has(normalizedQuery)) {
    const role = ROLE_DATABASE[normalizedQuery];
    seenKeys.add(normalizedQuery);
    results.push({
      key: normalizedQuery,
      name: role.name,
      description: role.description,
      score: 1,
      isAmbiguous: false
    });
  }

  // 4. Prefix matches in database
  Object.entries(ROLE_DATABASE).forEach(([key, role]) => {
    if (!seenKeys.has(key) && startsWithMatch(normalizedQuery, key)) {
      seenKeys.add(key);
      results.push({
        key,
        name: role.name,
        description: role.description,
        score: 0.9 + (normalizedQuery.length / key.length) * 0.09,
        isAmbiguous: false
      });
    }
  });

  // 5. Prefix matches in synonyms
  Object.entries(ROLE_SYNONYMS).forEach(([synonym, roleKey]) => {
    if (!seenKeys.has(roleKey) && startsWithMatch(normalizedQuery, synonym)) {
      const role = ROLE_DATABASE[roleKey];
      if (role) {
        seenKeys.add(roleKey);
        results.push({
          key: roleKey,
          name: role.name,
          description: role.description,
          score: 0.85 + (normalizedQuery.length / synonym.length) * 0.09,
          isAmbiguous: false
        });
      }
    }
  });

  // 6. Contains matches in database
  Object.entries(ROLE_DATABASE).forEach(([key, role]) => {
    if (!seenKeys.has(key) && containsMatch(normalizedQuery, key)) {
      seenKeys.add(key);
      results.push({
        key,
        name: role.name,
        description: role.description,
        score: 0.7,
        isAmbiguous: false
      });
    }
  });

  // 7. Fuzzy matches in database (for typos)
  Object.entries(ROLE_DATABASE).forEach(([key, role]) => {
    if (!seenKeys.has(key)) {
      const similarity = getSimilarity(normalizedQuery, key);
      if (similarity >= 0.6) {
        seenKeys.add(key);
        results.push({
          key,
          name: role.name,
          description: role.description,
          score: similarity * 0.6,
          isAmbiguous: false
        });
      }
    }
  });

  // 8. Fuzzy matches in synonyms
  Object.entries(ROLE_SYNONYMS).forEach(([synonym, roleKey]) => {
    if (!seenKeys.has(roleKey)) {
      const similarity = getSimilarity(normalizedQuery, synonym);
      if (similarity >= 0.6) {
        const role = ROLE_DATABASE[roleKey];
        if (role) {
          seenKeys.add(roleKey);
          results.push({
            key: roleKey,
            name: role.name,
            description: role.description,
            score: similarity * 0.55,
            isAmbiguous: false
          });
        }
      }
    }
  });

  // Sort by score (descending) and limit results
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

/**
 * Resolve a query to a role key
 * Handles synonyms and returns the canonical key
 *
 * @param {string} query - The search query
 * @returns {string|null} - The resolved role key or null
 */
export function resolveRole(query) {
  const normalizedQuery = query.toLowerCase().trim();

  // Check synonym first
  if (ROLE_SYNONYMS[normalizedQuery]) {
    return ROLE_SYNONYMS[normalizedQuery];
  }

  // Check database
  if (ROLE_DATABASE[normalizedQuery]) {
    return normalizedQuery;
  }

  return null;
}

/**
 * Check if a query is ambiguous (has multiple interpretations)
 *
 * @param {string} query - The search query
 * @returns {boolean}
 */
export function isAmbiguousQuery(query) {
  return query.toLowerCase().trim() in AMBIGUOUS_ROLES;
}

/**
 * Get disambiguation options for an ambiguous query
 *
 * @param {string} query - The search query
 * @returns {Array|null} - Array of disambiguation options or null
 */
export function getDisambiguations(query) {
  return AMBIGUOUS_ROLES[query.toLowerCase().trim()] || null;
}

/**
 * Check if a role is sensitive (medical, legal, financial)
 *
 * @param {string} roleKey - The role key
 * @returns {boolean}
 */
export function isSensitiveRole(roleKey) {
  const role = ROLE_DATABASE[roleKey.toLowerCase()];
  return role ? role.sensitive === true : false;
}

export default {
  searchRoles,
  resolveRole,
  isAmbiguousQuery,
  getDisambiguations,
  isSensitiveRole
};
