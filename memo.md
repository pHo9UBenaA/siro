npx npm@latest stage list @pho9ubenaa/siro;

npx npm@latest stage approve 1d3c268d-48f5-4f1c-938d-a793c3fc8591

---

gh release create v0.2.0 \
 --title "v0.2.0" \
 --notes "https://github.com/pHo9UBenaA/siro/blob/main/CHANGELOG.md#020"

npm deprecate your-package@1.2.0-rc.1 "This release candidate is deprecated. Please use >=1.2.0."
