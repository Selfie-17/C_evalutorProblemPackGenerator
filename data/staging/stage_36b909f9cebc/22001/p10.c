#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) == 1 && n > 0) {
        long long max_val, val;
        if (scanf("%lld", &max_val) == 1) {
            for (int i = 1; i < n; i++) {
                if (scanf("%lld", &val) == 1 && val > max_val) max_val = val;
            }
            printf("%lld", max_val);
        }
    }
    return 0;
}
