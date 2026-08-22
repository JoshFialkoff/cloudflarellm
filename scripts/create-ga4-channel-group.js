const { google } = require('googleapis');

// Load credentials from env var
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS env var');
  process.exit(1);
}

const PROPERTY_ID = (() => {
  const arg = process.argv.find(a => a.startsWith('--property='));
  return arg ? arg.split('=')[1] : null;
})();

if (!PROPERTY_ID) {
  console.error('Usage: node scripts/create-ga4-channel-group.js --property=properties/YOUR_ID');
  process.exit(1);
}

// The existing "Custom AI Tracking" group uses eachScopeSource.
// Custom channel groups need all fallback rules for non-AI traffic.
const AI_CHANNEL_GROUP = {
  displayName: 'AI Assistants',
  description: 'Sessions referred by AI assistants (ChatGPT, Perplexity, Claude, Gemini, Copilot, etc.)',
  groupingRule: [
    {
      displayName: 'AI Assistants',
      expression: {
        andGroup: {
          filterExpressions: [
            {
              orGroup: {
                filterExpressions: [
                  {
                    filter: {
                      fieldName: 'eachScopeSource',
                      stringFilter: {
                        matchType: 'FULL_REGEXP',
                        value: '^(chatgpt\\.com|openai\\.com|chat\\.openai\\.com|searchgpt\\.com|perplexity\\.ai|claude\\.ai|gemini\\.google\\.com|bard\\.google\\.com|copilot\\.microsoft\\.com|bing\\.com/chat|meta\\.ai|llama\\.meta\\.com|grok\\.x\\.ai|x\\.ai|poe\\.com|you\\.com|phind\\.com|phind\\.ai|kagi\\.com|duckduckgo\\.com/duckai)$',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    },
    // Fallback: default channel groups in order
    ...[
      'Direct',
      'Cross-network',
      'Paid Shopping',
      'Paid Search',
      'Paid Social',
      'Paid Video',
      'Paid Other',
      'Display',
      'Organic Shopping',
      'Organic Social',
      'Organic Video',
      'Organic Search',
      'Email',
      'Affiliates',
      'Referral',
      'Audio',
      'SMS',
      'Mobile Push Notifications',
    ].map(name => ({
      displayName: name,
      expression: {
        andGroup: {
          filterExpressions: [
            {
              orGroup: {
                filterExpressions: [
                  {
                    filter: {
                      fieldName: 'eachScopeDefaultChannelGroup',
                      stringFilter: { matchType: 'EXACT', value: name },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    })),
  ],
};

async function run() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/analytics.edit'],
  });
  const client = await auth.getClient();
  const admin = google.analyticsadmin({ version: 'v1alpha', auth: client });

  console.log(`Property ID: ${PROPERTY_ID}`);

  // Check if there's already an "AI Assistants" custom group
  const listRes = await admin.properties.channelGroups.list({ parent: PROPERTY_ID });
  const existing = (listRes.data.channelGroups || []).find(
    g => g.displayName === 'AI Assistants' && !g.systemDefined
  );

  if (existing) {
    console.log(`Existing custom group found: ${existing.name}`);
    console.log('Patching…');
    const patchRes = await admin.properties.channelGroups.patch({
      name: existing.name,
      updateMask: 'displayName,description,groupingRule',
      requestBody: AI_CHANNEL_GROUP,
    });
    console.log('✅ Patched:', patchRes.data.name);
    return;
  }

  console.log('No existing AI Assistants group found. Creating…');
  const createRes = await admin.properties.channelGroups.create({
    parent: PROPERTY_ID,
    requestBody: AI_CHANNEL_GROUP,
  });
  console.log('✅ Created:', createRes.data.name);
}

run().catch(err => {
  console.error('❌', err.message);
  if (err.response?.data) {
    console.error(JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
