import {
    spawn,
} from 'node:child_process';

const steps = [
    [
        'crawler syntax',
        process.execPath,
        [
            '--check',
            'src/crawler.mjs',
        ],
    ],

    [
        'export syntax',
        process.execPath,
        [
            '--check',
            'src/export.mjs',
        ],
    ],

    [
        'server syntax',
        process.execPath,
        [
            '--check',
            'src/server.mjs',
        ],
    ],

    [
        'client syntax',
        process.execPath,
        [
            '--check',
            'public/app.js',
        ],
    ],

    [
        'automated tests',
        process.execPath,
        [
            '--test',
            '--test-concurrency=1',
            'test/core.test.mjs',
            'test/crawler.integration.test.mjs',
            'test/web.integration.test.mjs',
        ],
    ],
];

function run(
    name,
    command,
    args,
) {
    return new Promise(
        (resolve, reject) => {
            console.log(
                `\n=== ${name.toUpperCase()} ===`,
            );

            const child = spawn(
                command,
                args,
                {
                    stdio: 'inherit',
                },
            );

            child.once(
                'error',
                reject,
            );

            child.once(
                'exit',
                (code) => {
                    if (code === 0) {
                        resolve();
                        return;
                    }

                    reject(
                        new Error(
                            `${name} failed: ${code}`,
                        ),
                    );
                },
            );
        },
    );
}

try {
    for (const step of steps) {
        await run(...step);
    }

    console.log('');
    console.log(
        'KALAX_CRAWL_VERIFY=PASS',
    );
} catch (error) {
    console.error('');
    console.error(
        'KALAX_CRAWL_VERIFY=FAIL',
    );

    console.error(
        error.message,
    );

    process.exitCode = 1;
}
