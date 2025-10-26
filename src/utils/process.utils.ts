import { spawn } from 'child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Execute command using child_process spawn
 * Returns Promise with stdout, stderr and exit code
 * 
 * @param command - Command to execute
 * @param args - Command arguments
 * @param acceptableCodes - Exit codes that are considered successful (default: [0])
 */
export function execCommand(
  command: string,
  args: string[],
  acceptableCodes: number[] = [0]
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const result = { stdout, stderr, code: code ?? -1 };
      
      if (acceptableCodes.includes(result.code)) {
        resolve(result);
      } else {
        reject(new Error(`Command failed with code ${result.code}: ${stderr || stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

