const fs = require('fs');
let code = fs.readFileSync('src/pages/Calculadoras.tsx', 'utf8');

// I replaced `            </div>` with `            </div>\n          </div>` globally.
// I then reversed it with `N;s/...` but maybe it didn't work.
// Let's just remove `          </div>` that immediately follows `            </div>\n` where it doesn't belong.
// Actually, it's easier to just read the file from disk before the sed! Wait, I don't have a backup.
// Let's just replace `            </div>\n          </div>` with `            </div>`.
code = code.replace(/            <\/div>\n          <\/div>/g, '            </div>');

fs.writeFileSync('src/pages/Calculadoras.tsx', code);
console.log('fixed');
