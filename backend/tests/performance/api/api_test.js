import http from "k6/http";
import { check, sleep, fail } from "k6";

export const options = {
  cloud: {
    projectID: 6549996,
    name: 'API Test K6 FMS Sample'
  },
  vus: 2,                // only 1 virtual user
  iterations: 3,         // run 3 pytest-style tests
  thresholds: {
    http_req_duration: ["p(95)<500"],    // 95% of requests under 500ms
    http_req_failed: ["rate==0"],        // no unexpected failures
  },
};


export function setup() {
    let primary = "https://overpolemical-marcel-noisomely.ngrok-free.dev";
    let fallback = "http://127.0.0.1:8000";
    const candidates = [primary, fallback];
    for (const base of candidates){
        try{
            const res = http.get(`${base}/health`);
            if (res.status === 200) {
                    console.log(`✔ Using base: ${base}`);
                    return { base };
                  } else {
                    console.log(`✖ Probe failed at ${base} -> ${res.status}`);
                  }
        }
        catch (e){
            console.log(`✖ Probe error at ${base}: ${e}`);
        }
    }

    fail(`No reachable base among: ${candidates.join(', ')}`)
}


export default function (data) {
  const iteration = __ITER;
  const base = data.base;

  if (iteration === 0) login_success(base);
  if (iteration === 1) login_wrong_password(base);
  if (iteration === 2) login_nonexistent_email(base);

  sleep(1);
}


// --------------------
//  INDIVIDUAL TESTS
// --------------------


function login_success(base) {
  const payload = {
    username: "test_user",
    email: "test_user@example.com",
    password: "test_pass",
  };

  const res = http.post(`${base}/auth/token`, JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "Login success: 200": (r) => r.status === 200,
    "Has access_token": (r) => "access_token" in r.json(),
    "Has refresh_token": (r) => "refresh_token" in r.json(),
    "Bearer token type": (r) => r.json().token_type === "bearer",
  });
}

function login_wrong_password(base) {
  const payload = {
    username: "test_user",
    email: "test_user@example.com",
    password: "wrong_pass",
  };

  const res = http.post(`${base}/auth/token`, JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "Wrong password: 400": (r) => r.status === 400,
    "Correct error message": (r) =>
      r.json().detail === "Incorrect email or password",
  });
}

function login_nonexistent_email(base) {
  const payload = {
    username: "test_user",
    email: "blablabla@example.com",
    password: "testpass",
  };

  const res = http.post(`${base}/auth/token`, JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "Non-existent email: 400": (r) => r.status === 400,
    "Correct error message": (r) =>
      r.json().detail === "Incorrect email or password",
  });
}