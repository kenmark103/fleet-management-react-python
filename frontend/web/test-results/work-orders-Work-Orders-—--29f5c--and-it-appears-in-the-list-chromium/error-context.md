# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "Fleet Manager" [level=1] [ref=e12]
    - paragraph [ref=e13]: Sign in to your account
  - generic [ref=e14]:
    - generic [ref=e15]:
      - generic [ref=e16]: Welcome back
      - generic [ref=e17]: Enter your credentials to continue
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Email
          - textbox "Email" [active] [ref=e22]:
            - /placeholder: you@example.com
        - generic [ref=e23]:
          - generic [ref=e24]:
            - generic [ref=e25]: Password
            - link "Forgot password?" [ref=e26] [cursor=pointer]:
              - /url: /forgot-password
          - textbox "Password" [ref=e27]:
            - /placeholder: ••••••••
            - text: "12345678"
      - generic [ref=e28]:
        - button "Sign in" [ref=e29]
        - generic [ref=e34]: or
        - button "Continue with Google" [ref=e35]:
          - img
          - text: Continue with Google
```