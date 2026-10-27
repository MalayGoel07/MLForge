// mlLibraryData.js
// Every group -> items -> { id, label, requires, code, qa: [{ q, a }] }
// NOTE: no backticks or ${ } inside the code strings (they are template literals).

export const libraryGroups = [
  /* ------------------------------------------------------------------ */
  {
    title: "Data Collection",
    icon: "⇣",
    items: [
      {
        id: "scrape-bs4",
        label: "Web Scraping (requests + BS4)",
        requires: "pip install requests beautifulsoup4 pandas",
        code: `import requests
from bs4 import BeautifulSoup
import pandas as pd

url = "https://quotes.toscrape.com/"
headers = {"User-Agent": "Mozilla/5.0 (learning-project)"}

resp = requests.get(url, headers=headers, timeout=10)
resp.raise_for_status()          # raise on 4xx / 5xx

soup = BeautifulSoup(resp.text, "html.parser")

rows = []
for card in soup.select("div.quote"):
    rows.append({
        "text": card.select_one("span.text").get_text(strip=True),
        "author": card.select_one("small.author").get_text(strip=True),
        "tags": [t.get_text() for t in card.select("a.tag")],
    })

df = pd.DataFrame(rows)
print(df.head())`,
        qa: [
          { q: "Why pass timeout and call raise_for_status()?", a: "timeout stops the script hanging forever on a dead server; raise_for_status() turns HTTP errors (404, 500) into exceptions instead of silently parsing an error page." },
          { q: "select() vs find_all()?", a: "select()/select_one() take CSS selectors (div.quote > span.text) and are usually shorter; find_all()/find() take tag names and attribute dicts." },
          { q: "What does requests NOT handle?", a: "JavaScript-rendered content. requests only gets the raw HTML; use Playwright/Selenium or find the underlying JSON API." },
        ],
      },
      {
        id: "scrape-pagination",
        label: "Scraping Multiple Pages",
        requires: "pip install requests beautifulsoup4 pandas",
        code: `import time
import requests
import pandas as pd
from bs4 import BeautifulSoup

base = "https://quotes.toscrape.com/page/{}/"
all_rows, page = [], 1

while True:
    r = requests.get(base.format(page), timeout=10)
    if r.status_code != 200:
        break

    soup = BeautifulSoup(r.text, "html.parser")
    cards = soup.select("div.quote")
    if not cards:                 # empty page -> we are done
        break

    all_rows += [
        {
            "text": c.select_one(".text").get_text(strip=True),
            "author": c.select_one(".author").get_text(strip=True),
        }
        for c in cards
    ]
    page += 1
    time.sleep(1)                 # be polite: rate-limit yourself

df = pd.DataFrame(all_rows)
df.to_csv("quotes.csv", index=False)
print(df.shape)`,
        qa: [
          { q: "How do you know when to stop paginating?", a: "Stop when the page returns a non-200 status or has zero matching items. Hard-coding the page count breaks when the site changes." },
          { q: "Why time.sleep() between requests?", a: "Avoids hammering the server / getting IP-banned. Also check robots.txt and the site's terms before scraping." },
        ],
      },
      {
        id: "scrape-playwright",
        label: "Dynamic Pages (Playwright)",
        requires: "pip install playwright && playwright install chromium",
        code: `from playwright.sync_api import sync_playwright
import pandas as pd

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("https://quotes.toscrape.com/js/")

    # wait until JavaScript has rendered the content
    page.wait_for_selector("div.quote")

    texts = page.locator("div.quote span.text").all_inner_texts()
    authors = page.locator("div.quote small.author").all_inner_texts()
    browser.close()

df = pd.DataFrame({"quote": texts, "author": authors})
print(df.head())`,
        qa: [
          { q: "When do you need Playwright/Selenium over requests?", a: "When the data is injected by JavaScript after page load, or the page needs clicks, scrolling or login flows." },
          { q: "Faster alternative to a headless browser?", a: "Open DevTools > Network > Fetch/XHR, find the JSON endpoint the page calls, and hit it directly with requests." },
        ],
      },
      {
        id: "read-html",
        label: "HTML Tables (pd.read_html)",
        requires: "pip install pandas lxml",
        code: `import pandas as pd

url = "https://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)"

# returns a LIST of DataFrames, one per <table> on the page
tables = pd.read_html(url)
print(len(tables), "tables found")

df = tables[0]
df.columns = [str(c).strip() for c in df.columns]
print(df.head())

# filter tables by a matching string
matched = pd.read_html(url, match="Population")`,
        qa: [
          { q: "What does pd.read_html return?", a: "A list of DataFrames - one for every <table> element found." },
          { q: "How to pick the right table?", a: "Use the match= argument (text/regex that must appear in the table) or index into the returned list." },
        ],
      },
      {
        id: "api-json",
        label: "REST API to DataFrame",
        requires: "pip install requests pandas",
        code: `import requests
import pandas as pd

resp = requests.get(
    "https://jsonplaceholder.typicode.com/posts",
    params={"userId": 1},
    timeout=10,
)
resp.raise_for_status()

data = resp.json()                 # list[dict]
df = pd.json_normalize(data)       # flattens nested JSON
print(df.head())

# nested example: json_normalize(data, record_path="items", meta=["id"])`,
        qa: [
          { q: "json_normalize vs pd.DataFrame(data)?", a: "json_normalize flattens nested dicts into dotted columns (user.address.city); DataFrame(data) keeps nested dicts as objects." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "NumPy & Pandas",
    icon: "▦",
    items: [
      {
        id: "numpy-essentials",
        label: "NumPy Essentials",
        requires: "pip install numpy",
        code: `import numpy as np

a = np.array([[1, 2, 3], [4, 5, 6]])
print(a.shape, a.dtype)            # (2, 3) int64

zeros = np.zeros((3, 3))
rng = np.random.default_rng(42)
x = rng.normal(loc=0, scale=1, size=(1000, 3))

# vectorised maths (no loops)
print(a * 2, a.mean(axis=0), a.sum(axis=1))

# reshape / transpose / stack
print(a.reshape(3, 2), a.T)
print(np.vstack([a, a]).shape, np.hstack([a, a]).shape)

# boolean masks and indexing
mask = a > 2
print(a[mask])

# broadcasting: subtract column means
centered = a - a.mean(axis=0)

# linear algebra
print(a @ a.T, np.linalg.inv(np.array([[2., 1.], [1., 3.]])))`,
        qa: [
          { q: "What is broadcasting?", a: "NumPy's rule for combining arrays of different shapes by virtually stretching size-1 dimensions, e.g. (2,3) - (3,) subtracts a vector from every row." },
          { q: "axis=0 vs axis=1?", a: "axis=0 collapses rows (operates down columns); axis=1 collapses columns (operates across each row)." },
          { q: "Why prefer vectorised code over for-loops?", a: "It runs in compiled C, is typically 10-100x faster and more readable." },
        ],
      },
      {
        id: "pandas-basics",
        label: "Pandas: Load & Inspect",
        requires: "pip install pandas",
        code: `import pandas as pd

df = pd.read_csv("data.csv")

df.head()                  # first rows
df.shape                   # (rows, cols)
df.info()                  # dtypes + non-null counts
df.describe()              # numeric summary
df.describe(include="object")
df.columns.tolist()
df.dtypes

# selecting
df["age"]                  # Series
df[["age", "salary"]]      # DataFrame
df.loc[0:5, ["age"]]       # label based
df.iloc[0:5, 0:2]          # position based

# filtering
adults = df[df["age"] >= 18]
rich = df.query("salary > 50000 and city == 'Delhi'")

# sorting / unique
df.sort_values("salary", ascending=False).head(10)
df["city"].value_counts()
df["city"].nunique()`,
        qa: [
          { q: "loc vs iloc?", a: "loc selects by label (end of slice is inclusive); iloc selects by integer position (end exclusive)." },
          { q: "Why does df[df.a > 1 and df.b < 2] fail?", a: "Python's 'and' needs a single bool. Use & with parentheses: df[(df.a > 1) & (df.b < 2)] or df.query()." },
        ],
      },
      {
        id: "pandas-cleaning",
        label: "Pandas: Data Cleaning",
        requires: "pip install pandas",
        code: `import pandas as pd
import numpy as np

df = pd.read_csv("data.csv")

# --- missing values ---
print(df.isna().sum())
df["age"] = df["age"].fillna(df["age"].median())
df["city"] = df["city"].fillna("Unknown")
df = df.dropna(subset=["target"])          # drop rows missing the label

# --- duplicates ---
print(df.duplicated().sum())
df = df.drop_duplicates().reset_index(drop=True)

# --- dtypes ---
df["date"] = pd.to_datetime(df["date"], errors="coerce")
df["price"] = pd.to_numeric(df["price"], errors="coerce")
df["category"] = df["category"].astype("category")

# --- text cleanup ---
df["name"] = df["name"].str.strip().str.lower()
df["phone"] = df["phone"].str.replace(r"[^0-9]", "", regex=True)

# --- rename / drop ---
df = df.rename(columns={"old": "new"}).drop(columns=["id"])`,
        qa: [
          { q: "Mean or median for imputing a skewed column?", a: "Median - it is robust to outliers and skew. Mean is fine for roughly symmetric data." },
          { q: "What does errors='coerce' do?", a: "Turns unparseable values into NaT/NaN instead of raising, so you can then count and handle them." },
        ],
      },
      {
        id: "pandas-groupby",
        label: "Pandas: GroupBy, Merge, Pivot",
        requires: "pip install pandas",
        code: `import pandas as pd

df = pd.read_csv("sales.csv")
customers = pd.read_csv("customers.csv")

# --- groupby + aggregate ---
summary = (
    df.groupby("region")
      .agg(total=("revenue", "sum"),
           avg=("revenue", "mean"),
           orders=("order_id", "count"))
      .reset_index()
      .sort_values("total", ascending=False)
)

# --- transform: add group stat back to every row ---
df["region_mean"] = df.groupby("region")["revenue"].transform("mean")

# --- merge (SQL-style join) ---
merged = df.merge(customers, on="customer_id", how="left")

# --- pivot table ---
pivot = df.pivot_table(
    index="region", columns="month",
    values="revenue", aggfunc="sum", fill_value=0,
)

# --- apply a custom function ---
df["tier"] = df["revenue"].apply(lambda x: "high" if x > 1000 else "low")`,
        qa: [
          { q: "agg vs transform?", a: "agg returns one row per group (smaller table); transform returns a result the same length as the input, aligned to original rows." },
          { q: "Difference between how='left' and how='inner'?", a: "left keeps all rows from the left table (NaN where no match); inner keeps only keys present in both." },
        ],
      },
      {
        id: "feature-engineering",
        label: "Feature Engineering",
        requires: "pip install pandas numpy",
        code: `import numpy as np
import pandas as pd

df = pd.read_csv("data.csv", parse_dates=["date"])

# --- date features ---
df["year"] = df["date"].dt.year
df["month"] = df["date"].dt.month
df["dayofweek"] = df["date"].dt.dayofweek
df["is_weekend"] = (df["dayofweek"] >= 5).astype(int)

# --- numeric transforms ---
df["log_price"] = np.log1p(df["price"])        # tame right skew
df["price_per_sqft"] = df["price"] / df["sqft"]

# --- binning ---
df["age_group"] = pd.cut(df["age"], bins=[0, 18, 35, 60, 100],
                         labels=["teen", "young", "adult", "senior"])
df["income_q"] = pd.qcut(df["income"], q=4, labels=False)

# --- interaction / polynomial ---
df["bed_x_bath"] = df["bedrooms"] * df["bathrooms"]

# --- lag / rolling (time series) ---
df = df.sort_values("date")
df["lag_1"] = df["sales"].shift(1)
df["roll_7"] = df["sales"].rolling(7).mean()`,
        qa: [
          { q: "Why log1p instead of log?", a: "log1p(x) = log(1 + x) handles zeros safely and is more accurate for small x." },
          { q: "cut vs qcut?", a: "cut makes equal-width bins; qcut makes equal-frequency bins (quantiles)." },
          { q: "Risk with lag/rolling features?", a: "Data leakage - make sure the window only uses past values and split train/test by time, not randomly." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "EDA",
    icon: "◎",
    items: [
      {
        id: "eda-overview",
        label: "Quick EDA Report",
        requires: "pip install pandas numpy",
        code: `import pandas as pd

df = pd.read_csv("data.csv")

print("Shape:", df.shape)
print("\\nDtypes:\\n", df.dtypes.value_counts())

# one-table health check
report = pd.DataFrame({
    "dtype": df.dtypes,
    "missing": df.isna().sum(),
    "missing_%": (df.isna().mean() * 100).round(2),
    "unique": df.nunique(),
})
print(report.sort_values("missing_%", ascending=False))

print("\\nDuplicates:", df.duplicated().sum())

num_cols = df.select_dtypes("number").columns
cat_cols = df.select_dtypes(exclude="number").columns

print(df[num_cols].describe().T)
print(df[num_cols].skew().sort_values())     # skewness per column

for c in cat_cols:
    print("\\n", c)
    print(df[c].value_counts(normalize=True).head(5))`,
        qa: [
          { q: "What are the first 5 things to check in EDA?", a: "Shape, dtypes, missing values, duplicates, and summary statistics (plus target distribution)." },
          { q: "What does skew > 1 tell you?", a: "A strongly right-skewed distribution - consider a log/Box-Cox transform for linear models." },
        ],
      },
      {
        id: "eda-missing",
        label: "Missing Value Analysis",
        requires: "pip install pandas matplotlib seaborn",
        code: `import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv("data.csv")

# bar of % missing per column
miss = (df.isna().mean() * 100).sort_values(ascending=False)
miss = miss[miss > 0]

fig, ax = plt.subplots(1, 2, figsize=(14, 5))
miss.plot.barh(ax=ax[0], color="#818cf8")
ax[0].set_title("% missing per column")

# heatmap of where values are missing
sns.heatmap(df.isna(), cbar=False, yticklabels=False, ax=ax[1])
ax[1].set_title("Missingness pattern")
plt.tight_layout()
plt.show()

# is missingness related to the target?
df["age_missing"] = df["age"].isna().astype(int)
print(df.groupby("age_missing")["target"].mean())`,
        qa: [
          { q: "MCAR vs MAR vs MNAR?", a: "Missing completely at random / at random (depends on observed data) / not at random (depends on the missing value itself). MNAR is the hardest to handle." },
          { q: "When is dropping rows acceptable?", a: "When few rows are affected (<~5%) and the missingness is random. Otherwise impute, and consider a was_missing indicator column." },
        ],
      },
      {
        id: "eda-correlation",
        label: "Correlation Heatmap",
        requires: "pip install pandas seaborn matplotlib numpy",
        code: `import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

df = pd.read_csv("data.csv")
corr = df.select_dtypes("number").corr()       # pearson by default

mask = np.triu(np.ones_like(corr, dtype=bool)) # hide duplicate half
plt.figure(figsize=(10, 8))
sns.heatmap(corr, mask=mask, annot=True, fmt=".2f",
            cmap="coolwarm", center=0, square=True)
plt.title("Correlation matrix")
plt.show()

# correlation with the target, ranked
print(corr["target"].drop("target").sort_values(key=abs, ascending=False))

# highly correlated feature pairs (multicollinearity)
upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
pairs = upper.stack().loc[lambda s: s.abs() > 0.85]
print(pairs)

# rank-based (non-linear monotonic): df.corr(method="spearman")`,
        qa: [
          { q: "Pearson vs Spearman?", a: "Pearson measures linear relationships; Spearman uses ranks and captures any monotonic relationship, robust to outliers." },
          { q: "Why care about correlated features?", a: "Multicollinearity makes linear-model coefficients unstable and adds redundancy; drop one of each highly correlated pair or use PCA/regularisation." },
          { q: "Does correlation imply causation?", a: "No. Two variables can correlate through a confounder or by chance." },
        ],
      },
      {
        id: "eda-outliers",
        label: "Distributions & Outliers",
        requires: "pip install pandas numpy matplotlib seaborn scipy",
        code: `import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from scipy import stats

df = pd.read_csv("data.csv")
col = "price"

fig, ax = plt.subplots(1, 2, figsize=(12, 4))
sns.histplot(df[col], kde=True, ax=ax[0])
sns.boxplot(x=df[col], ax=ax[1])
plt.show()

# --- IQR rule ---
q1, q3 = df[col].quantile([0.25, 0.75])
iqr = q3 - q1
low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
outliers = df[(df[col] < low) | (df[col] > high)]
print(f"{len(outliers)} outliers outside [{low:.1f}, {high:.1f}]")

# --- z-score rule ---
z = np.abs(stats.zscore(df[col].dropna()))
print("z > 3:", (z > 3).sum())

# --- handle: cap (winsorise) instead of dropping ---
df[col + "_capped"] = df[col].clip(lower=low, upper=high)

# normality check
print(stats.shapiro(df[col].sample(min(len(df), 500), random_state=0)))`,
        qa: [
          { q: "How does the IQR rule work?", a: "Anything below Q1 - 1.5*IQR or above Q3 + 1.5*IQR is flagged. It works for skewed data because it doesn't assume normality." },
          { q: "Always remove outliers?", a: "No. They may be real signal (fraud, rare events). Investigate first; cap or use robust models/scalers if they are noise." },
        ],
      },
      {
        id: "eda-target",
        label: "Target & Class Balance",
        requires: "pip install pandas seaborn matplotlib",
        code: `import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

df = pd.read_csv("data.csv")

# --- classification: class balance ---
counts = df["target"].value_counts()
print(counts)
print((counts / len(df) * 100).round(1))

sns.countplot(data=df, x="target")
plt.title("Class distribution")
plt.show()

# --- regression: target distribution ---
# sns.histplot(df["target"], kde=True)

# --- feature vs target ---
sns.boxplot(data=df, x="target", y="age")
plt.show()

# categorical feature vs target rate
print(df.groupby("city")["target"].mean().sort_values(ascending=False))`,
        qa: [
          { q: "Why does accuracy mislead on imbalanced data?", a: "A model predicting the majority class always can reach 95% accuracy while catching zero minority cases. Use precision/recall/F1/PR-AUC." },
          { q: "Ways to handle imbalance?", a: "class_weight='balanced', resampling (SMOTE / undersampling), threshold tuning, and stratified splits." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "Visualization",
    icon: "◔",
    items: [
      {
        id: "matplotlib-basics",
        label: "Matplotlib Basics",
        requires: "pip install matplotlib numpy",
        code: `import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 10, 100)

fig, ax = plt.subplots(figsize=(8, 5))     # object-oriented API
ax.plot(x, np.sin(x), label="sin(x)", color="tab:indigo", lw=2)
ax.plot(x, np.cos(x), label="cos(x)", linestyle="--")
ax.scatter(x[::10], np.sin(x[::10]), c="red", zorder=3)

ax.set_title("Line + scatter")
ax.set_xlabel("x")
ax.set_ylabel("y")
ax.grid(alpha=0.3)
ax.legend()

fig.tight_layout()
fig.savefig("plot.png", dpi=150)
plt.show()

# other common plots
# ax.bar(cats, vals)      ax.hist(data, bins=30)
# ax.scatter(x, y, c=z)   ax.boxplot(list_of_arrays)`,
        qa: [
          { q: "Figure vs Axes?", a: "Figure is the whole canvas; Axes is one plot inside it (with its own x/y axis). Most plotting methods live on Axes." },
          { q: "Why prefer plt.subplots() over plt.plot() directly?", a: "It gives explicit fig/ax objects, so multiple plots and customisation stay clean and predictable." },
        ],
      },
      {
        id: "matplotlib-subplots",
        label: "Subplot Grid of Features",
        requires: "pip install matplotlib pandas seaborn",
        code: `import math
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("data.csv")
num_cols = df.select_dtypes("number").columns.tolist()

n_cols = 3
n_rows = math.ceil(len(num_cols) / n_cols)

fig, axes = plt.subplots(n_rows, n_cols, figsize=(5 * n_cols, 3.5 * n_rows))
axes = axes.flatten()

for ax, col in zip(axes, num_cols):
    ax.hist(df[col].dropna(), bins=30, color="#818cf8", edgecolor="white")
    ax.set_title(col)

for ax in axes[len(num_cols):]:     # hide unused panels
    ax.axis("off")

fig.suptitle("Feature distributions", y=1.02, fontsize=14)
fig.tight_layout()
plt.show()`,
        qa: [
          { q: "Why flatten() the axes array?", a: "plt.subplots returns a 2-D array for grids; flatten() lets you loop over every panel with a single index." },
        ],
      },
      {
        id: "seaborn-plots",
        label: "Seaborn Statistical Plots",
        requires: "pip install seaborn matplotlib pandas",
        code: `import seaborn as sns
import matplotlib.pyplot as plt

sns.set_theme(style="whitegrid", context="notebook")
df = sns.load_dataset("tips")

# distribution
sns.histplot(df, x="total_bill", hue="sex", kde=True)
plt.show()

# categorical comparison
sns.boxplot(data=df, x="day", y="total_bill", hue="smoker")
plt.show()
sns.violinplot(data=df, x="day", y="tip")
plt.show()

# relationship + regression line
sns.regplot(data=df, x="total_bill", y="tip", scatter_kws={"alpha": 0.5})
plt.show()

# all pairwise relationships
sns.pairplot(df, hue="time", corner=True)
plt.show()

# counts and averages
sns.countplot(data=df, x="day")
sns.barplot(data=df, x="day", y="tip", errorbar="sd")
plt.show()`,
        qa: [
          { q: "When use a violin plot over a box plot?", a: "When the distribution shape matters (bimodality, density); a box plot only shows quartiles and outliers." },
          { q: "What does pairplot show?", a: "A scatter-plot matrix of every numeric pair with histograms/KDE on the diagonal - quick for spotting relationships and clusters." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "Preprocessing",
    icon: "⚙",
    items: [
      {
        id: "encoding",
        label: "Categorical Encoding",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, LabelEncoder

df = pd.read_csv("data.csv")

# --- One-hot (nominal categories, no order) ---
ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
encoded = ohe.fit_transform(df[["city"]])
cols = ohe.get_feature_names_out(["city"])
df_ohe = pd.DataFrame(encoded, columns=cols, index=df.index)

# --- quick pandas version ---
df2 = pd.get_dummies(df, columns=["city"], drop_first=True)

# --- Ordinal (ordered categories) ---
oe = OrdinalEncoder(categories=[["low", "medium", "high"]])
df["level_enc"] = oe.fit_transform(df[["level"]])

# --- Label encoding: TARGET only ---
le = LabelEncoder()
y = le.fit_transform(df["target"])
print(le.classes_)

# --- Frequency encoding (high-cardinality) ---
freq = df["zipcode"].value_counts(normalize=True)
df["zip_freq"] = df["zipcode"].map(freq)`,
        qa: [
          { q: "One-hot vs ordinal encoding?", a: "One-hot for unordered categories (avoids implying order); ordinal when categories have a real rank (low < medium < high)." },
          { q: "Why handle_unknown='ignore'?", a: "At prediction time an unseen category would otherwise crash; 'ignore' encodes it as all zeros." },
          { q: "Why use LabelEncoder only on targets?", a: "It assigns arbitrary integers, which a linear/distance model would misread as order in features." },
        ],
      },
      {
        id: "scaling",
        label: "Feature Scaling",
        requires: "pip install scikit-learn",
        code: `from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler
from sklearn.model_selection import train_test_split
import pandas as pd

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"]).select_dtypes("number")
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

scaler = StandardScaler()          # (x - mean) / std
# scaler = MinMaxScaler()          # scales to [0, 1]
# scaler = RobustScaler()          # uses median / IQR, outlier-safe

X_train_s = scaler.fit_transform(X_train)   # learn on TRAIN only
X_test_s = scaler.transform(X_test)         # apply to test

print(scaler.mean_[:3], scaler.scale_[:3])`,
        qa: [
          { q: "Why fit the scaler on the training set only?", a: "Fitting on all data leaks test-set statistics into training (data leakage) and inflates your score." },
          { q: "Which models need scaling?", a: "Distance/gradient based: KNN, SVM, logistic/linear (with regularisation), PCA, neural nets, K-Means. Tree models do not." },
          { q: "StandardScaler vs MinMaxScaler?", a: "Standard centres to mean 0, std 1 (good default); MinMax squeezes to a fixed range but is sensitive to outliers." },
        ],
      },
      {
        id: "imputation",
        label: "Imputation (Simple & KNN)",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.impute import SimpleImputer, KNNImputer

df = pd.read_csv("data.csv")
num = df.select_dtypes("number").drop(columns=["target"])
cat = df.select_dtypes(exclude="number")

# median for numeric, most frequent for categorical
num_imp = SimpleImputer(strategy="median", add_indicator=True)
num_filled = num_imp.fit_transform(num)

cat_imp = SimpleImputer(strategy="most_frequent")
cat_filled = cat_imp.fit_transform(cat)

# KNN: fill using the k most similar rows
knn = KNNImputer(n_neighbors=5, weights="distance")
num_knn = knn.fit_transform(num)

# add_indicator=True appends 0/1 columns marking what was missing`,
        qa: [
          { q: "What does add_indicator=True do?", a: "Adds binary columns flagging which values were imputed - the fact that a value was missing can itself be predictive." },
          { q: "When use KNNImputer?", a: "When features are correlated and the dataset is small/medium; it is slow on big data and needs scaled features." },
        ],
      },
      {
        id: "pipeline",
        label: "Pipeline + ColumnTransformer",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

num_cols = X.select_dtypes("number").columns
cat_cols = X.select_dtypes(exclude="number").columns

num_pipe = Pipeline([
    ("impute", SimpleImputer(strategy="median")),
    ("scale", StandardScaler()),
])
cat_pipe = Pipeline([
    ("impute", SimpleImputer(strategy="most_frequent")),
    ("ohe", OneHotEncoder(handle_unknown="ignore")),
])

preprocess = ColumnTransformer([
    ("num", num_pipe, num_cols),
    ("cat", cat_pipe, cat_cols),
])

model = Pipeline([
    ("prep", preprocess),
    ("clf", RandomForestClassifier(n_estimators=200, random_state=42)),
])

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
model.fit(X_train, y_train)
print(classification_report(y_test, model.predict(X_test)))`,
        qa: [
          { q: "Main benefit of a Pipeline?", a: "Bundles preprocessing + model so fit/predict apply identical steps, prevents leakage inside cross-validation, and makes saving one object easy." },
          { q: "What does ColumnTransformer do?", a: "Applies different transformers to different column subsets (e.g. scale numeric, one-hot categorical) and concatenates the output." },
        ],
      },
      {
        id: "imbalance",
        label: "Imbalanced Data (SMOTE)",
        requires: "pip install imbalanced-learn scikit-learn",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Option 1: class weights (no resampling)
clf = LogisticRegression(class_weight="balanced", max_iter=1000)
clf.fit(X_train, y_train)

# Option 2: SMOTE inside a pipeline (applies to TRAIN folds only)
pipe = ImbPipeline([
    ("smote", SMOTE(random_state=42)),
    ("clf", LogisticRegression(max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(classification_report(y_test, pipe.predict(X_test)))`,
        qa: [
          { q: "Why must SMOTE be applied after the train/test split?", a: "Otherwise synthetic samples derived from test rows leak into training and your metrics are inflated." },
          { q: "Which metrics for imbalanced problems?", a: "Precision, recall, F1, PR-AUC, and balanced accuracy - not plain accuracy." },
        ],
      },
      {
        id: "feature-selection",
        label: "Feature Selection",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.feature_selection import (
    VarianceThreshold, SelectKBest, f_classif, RFE, SelectFromModel,
)
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"]).select_dtypes("number")
y = df["target"]

# 1) filter: drop near-constant features
vt = VarianceThreshold(threshold=0.01)
X_vt = vt.fit_transform(X)

# 2) filter: univariate statistical test
skb = SelectKBest(score_func=f_classif, k=10).fit(X, y)
print(X.columns[skb.get_support()].tolist())

# 3) wrapper: recursive feature elimination
rfe = RFE(LogisticRegression(max_iter=1000), n_features_to_select=8).fit(X, y)
print(X.columns[rfe.support_].tolist())

# 4) embedded: keep features the model finds important
sfm = SelectFromModel(RandomForestClassifier(n_estimators=200, random_state=42))
sfm.fit(X, y)
print(X.columns[sfm.get_support()].tolist())`,
        qa: [
          { q: "Filter vs wrapper vs embedded methods?", a: "Filter: score features independently (fast). Wrapper: search subsets by training models (RFE, slow). Embedded: selection happens during training (Lasso, tree importances)." },
        ],
      },
      {
        id: "splitting-cv",
        label: "Train/Test Split & K-Fold",
        requires: "pip install scikit-learn",
        code: `import pandas as pd
from sklearn.model_selection import (
    train_test_split, KFold, StratifiedKFold, TimeSeriesSplit, cross_val_score,
)
from sklearn.ensemble import RandomForestClassifier

df = pd.read_csv("data.csv")
X, y = df.drop(columns=["target"]), df["target"]

# train / validation / test = 60 / 20 / 20
X_tmp, X_test, y_tmp, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
X_train, X_val, y_train, y_val = train_test_split(
    X_tmp, y_tmp, test_size=0.25, random_state=42, stratify=y_tmp
)

model = RandomForestClassifier(random_state=42)

# stratified k-fold keeps class ratios in every fold
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
scores = cross_val_score(model, X, y, cv=skf, scoring="f1_macro")
print(scores.round(3), "mean:", scores.mean().round(3))

# time series: never shuffle, always train on the past
tscv = TimeSeriesSplit(n_splits=5)`,
        qa: [
          { q: "Why a separate validation set AND test set?", a: "Validation is used to tune/choose models; the test set is touched once at the end for an unbiased estimate." },
          { q: "Why stratify?", a: "Preserves the class proportions in each split, essential for imbalanced classification." },
          { q: "How to split time-series data?", a: "Chronologically (TimeSeriesSplit); random shuffling leaks future info into the past." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "Dimensionality Reduction",
    icon: "⌖",
    items: [
      {
        id: "pca",
        label: "PCA",
        requires: "pip install scikit-learn matplotlib numpy",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"]).select_dtypes("number")
y = df["target"]

# PCA is variance based -> ALWAYS scale first
X_scaled = StandardScaler().fit_transform(X)

pca = PCA().fit(X_scaled)
cum = np.cumsum(pca.explained_variance_ratio_)

plt.plot(range(1, len(cum) + 1), cum, marker="o")
plt.axhline(0.95, color="red", ls="--", label="95% variance")
plt.xlabel("Components")
plt.ylabel("Cumulative explained variance")
plt.legend()
plt.show()

# keep enough components for 95% of the variance
pca95 = PCA(n_components=0.95)
X_pca = pca95.fit_transform(X_scaled)
print("Original:", X.shape[1], "-> reduced:", X_pca.shape[1])

# 2-D projection for visualisation
X_2d = PCA(n_components=2).fit_transform(X_scaled)
plt.scatter(X_2d[:, 0], X_2d[:, 1], c=y, cmap="viridis", alpha=0.7)
plt.xlabel("PC1")
plt.ylabel("PC2")
plt.show()

# loadings: which original features drive each component
loadings = pd.DataFrame(pca95.components_.T, index=X.columns)
print(loadings.iloc[:, :2])`,
        qa: [
          { q: "What does PCA actually do?", a: "Finds orthogonal directions (principal components) of maximum variance and projects the data onto the top ones, reducing dimensions with minimal information loss." },
          { q: "Why scale before PCA?", a: "A feature with a large numeric range would dominate the variance and hijack the first component." },
          { q: "How to choose n_components?", a: "Use the cumulative explained-variance curve (e.g. 95%), or pass a float like PCA(n_components=0.95)." },
          { q: "Downside of PCA?", a: "Components are linear mixes, so they are hard to interpret, and PCA misses non-linear structure." },
        ],
      },
      {
        id: "tsne-umap",
        label: "t-SNE & UMAP",
        requires: "pip install scikit-learn umap-learn matplotlib",
        code: `import pandas as pd
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

df = pd.read_csv("data.csv")
X = StandardScaler().fit_transform(df.drop(columns=["target"]).select_dtypes("number"))
y = df["target"]

# speed tip: compress to ~50 dims with PCA first
X_pre = PCA(n_components=min(50, X.shape[1])).fit_transform(X)

tsne = TSNE(n_components=2, perplexity=30, learning_rate="auto",
            init="pca", random_state=42)
X_tsne = tsne.fit_transform(X_pre)

plt.scatter(X_tsne[:, 0], X_tsne[:, 1], c=y, cmap="tab10", s=10)
plt.title("t-SNE")
plt.show()

# UMAP: faster, keeps more global structure
# import umap
# X_umap = umap.UMAP(n_neighbors=15, min_dist=0.1, random_state=42).fit_transform(X_pre)`,
        qa: [
          { q: "Can you use t-SNE output as model features?", a: "Generally no - it is for visualisation only; distances between clusters and cluster sizes are not meaningful, and it cannot transform new data." },
          { q: "t-SNE vs PCA?", a: "PCA is linear, fast and deterministic; t-SNE is non-linear and preserves local neighbourhoods but is slow and stochastic." },
        ],
      },
      {
        id: "lda",
        label: "LDA (Supervised Reduction)",
        requires: "pip install scikit-learn",
        code: `import pandas as pd
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

df = pd.read_csv("data.csv")
X = StandardScaler().fit_transform(df.drop(columns=["target"]).select_dtypes("number"))
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# max components = min(n_features, n_classes - 1)
lda = LinearDiscriminantAnalysis(n_components=2)
X_train_lda = lda.fit_transform(X_train, y_train)   # uses labels!
X_test_lda = lda.transform(X_test)

print(lda.explained_variance_ratio_)
print("Classifier accuracy:", lda.score(X_test, y_test))`,
        qa: [
          { q: "PCA vs LDA?", a: "PCA is unsupervised and maximises variance; LDA is supervised and maximises class separability using labels." },
          { q: "Max number of LDA components?", a: "min(n_features, n_classes - 1)." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "Regression",
    icon: "↗",
    items: [
      {
        id: "linear-regression",
        label: "Linear Regression",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

# Load your dataset
df = pd.read_csv("data.csv")

# Select features and target
X = df[["feature"]]
y = df["target"]

# Split the data
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Train the model
model = LinearRegression()
model.fit(X_train, y_train)

# Make predictions
y_pred = model.predict(X_test)

print("MSE:", mean_squared_error(y_test, y_pred))
print("R²:", r2_score(y_test, y_pred))`,
        qa: [
          { q: "What does R² mean?", a: "The share of target variance explained by the model. 1 is perfect, 0 equals predicting the mean, negative is worse than the mean." },
          { q: "Key assumptions of linear regression?", a: "Linearity, independent errors, constant error variance (homoscedasticity), roughly normal residuals, and little multicollinearity." },
        ],
      },
      {
        id: "polynomial-regression",
        label: "Polynomial Regression",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import make_pipeline
from sklearn.metrics import r2_score

df = pd.read_csv("data.csv")
X = df[["feature"]]
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = make_pipeline(
    PolynomialFeatures(degree=2, include_bias=False),
    LinearRegression()
)
model.fit(X_train, y_train)

predictions = model.predict(X_test)
print("R²:", r2_score(y_test, predictions))`,
        qa: [
          { q: "Is polynomial regression a non-linear model?", a: "It is linear in its coefficients; the features (x, x², x³...) are non-linear in x." },
          { q: "Risk of a high degree?", a: "Overfitting - train R² climbs while test R² drops. Pick degree with cross-validation or add regularisation." },
        ],
      },
      {
        id: "ridge-regression",
        label: "Ridge Regression",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = Ridge(alpha=1.0)
model.fit(X_train, y_train)

predictions = model.predict(X_test)
print("MSE:", mean_squared_error(y_test, predictions))`,
        qa: [
          { q: "What does Ridge add to linear regression?", a: "An L2 penalty (alpha * sum of squared coefficients) that shrinks coefficients, reducing variance and handling multicollinearity." },
          { q: "What happens as alpha grows?", a: "Coefficients shrink toward 0 (never exactly 0) - more bias, less variance." },
        ],
      },
      {
        id: "lasso-elasticnet",
        label: "Lasso & ElasticNet",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.linear_model import LassoCV, ElasticNetCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

lasso = make_pipeline(StandardScaler(), LassoCV(cv=5, random_state=42))
lasso.fit(X_train, y_train)
print("Lasso R²:", r2_score(y_test, lasso.predict(X_test)))

coefs = pd.Series(lasso[-1].coef_, index=X.columns)
print("Kept features:", coefs[coefs != 0].index.tolist())

enet = make_pipeline(
    StandardScaler(),
    ElasticNetCV(l1_ratio=[0.2, 0.5, 0.8], cv=5, random_state=42),
)
enet.fit(X_train, y_train)
print("ElasticNet R²:", r2_score(y_test, enet.predict(X_test)))`,
        qa: [
          { q: "Lasso vs Ridge?", a: "Lasso uses L1 and can set coefficients exactly to zero (feature selection); Ridge uses L2 and only shrinks them." },
          { q: "When use ElasticNet?", a: "When features are correlated: it mixes L1 and L2 so groups of correlated features are kept together instead of Lasso picking one randomly." },
        ],
      },
      {
        id: "random-forest-regressor",
        label: "Random Forest Regressor",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestRegressor(
    n_estimators=300, max_depth=None, min_samples_leaf=2,
    n_jobs=-1, random_state=42, oob_score=True,
)
model.fit(X_train, y_train)

pred = model.predict(X_test)
print("MAE:", mean_absolute_error(y_test, pred))
print("R²:", r2_score(y_test, pred))
print("OOB R²:", model.oob_score_)

imp = pd.Series(model.feature_importances_, index=X.columns)
print(imp.sort_values(ascending=False).head(10))`,
        qa: [
          { q: "What is the OOB score?", a: "Each tree trains on a bootstrap sample, so the left-out rows give a free validation estimate without a separate set." },
          { q: "Can a random forest extrapolate beyond the training range?", a: "No. Predictions are averages of training targets, so they stay inside the observed range." },
        ],
      },
      {
        id: "xgboost-regressor",
        label: "XGBoost Regressor",
        requires: "pip install xgboost scikit-learn pandas",
        code: `import pandas as pd
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = XGBRegressor(
    n_estimators=1000, learning_rate=0.05, max_depth=5,
    subsample=0.8, colsample_bytree=0.8,
    early_stopping_rounds=50, random_state=42,
)
model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

pred = model.predict(X_test)
print("RMSE:", mean_squared_error(y_test, pred) ** 0.5)
print("R²:", r2_score(y_test, pred))
print("Best iteration:", model.best_iteration)`,
        qa: [
          { q: "Bagging vs boosting?", a: "Bagging (random forest) trains trees independently and averages them to cut variance; boosting trains trees sequentially, each fixing the previous errors, to cut bias." },
          { q: "What is early stopping?", a: "Stop adding trees when the validation metric stops improving for N rounds - prevents overfitting and saves time." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "Classification",
    icon: "◈",
    items: [
      {
        id: "logistic-regression",
        label: "Logistic Regression",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = LogisticRegression(max_iter=1000)
model.fit(X_train, y_train)

predictions = model.predict(X_test)
print("Accuracy:", accuracy_score(y_test, predictions))
print(classification_report(y_test, predictions))`,
        qa: [
          { q: "Why is it called regression if it classifies?", a: "It regresses the log-odds linearly, then the sigmoid converts that into a probability; a threshold (0.5) makes the class." },
          { q: "What does the C parameter control?", a: "Inverse regularisation strength: smaller C = stronger regularisation." },
        ],
      },
      {
        id: "knn",
        label: "K-Nearest Neighbors (KNN)",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import classification_report

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = make_pipeline(
    StandardScaler(),
    KNeighborsClassifier(n_neighbors=5)
)
model.fit(X_train, y_train)

predictions = model.predict(X_test)
print(classification_report(y_test, predictions))`,
        qa: [
          { q: "Why must KNN features be scaled?", a: "It relies on distances, so a large-range feature would dominate the neighbour search." },
          { q: "Effect of k?", a: "Small k = low bias, high variance (noisy, overfits); large k = smoother boundary, may underfit." },
        ],
      },
      {
        id: "naive-bayes",
        label: "Naive Bayes",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import accuracy_score, classification_report

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = GaussianNB()
model.fit(X_train, y_train)

predictions = model.predict(X_test)
print("Accuracy:", accuracy_score(y_test, predictions))
print(classification_report(y_test, predictions))`,
        qa: [
          { q: "What is the 'naive' assumption?", a: "Features are conditionally independent given the class, so P(x1..xn | y) = product of P(xi | y)." },
          { q: "Gaussian vs Multinomial NB?", a: "Gaussian for continuous features (assumes normal); Multinomial for counts such as word frequencies." },
        ],
      },
      {
        id: "decision-tree",
        label: "Decision Tree",
        requires: "pip install scikit-learn pandas matplotlib",
        code: `import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.metrics import classification_report

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = DecisionTreeClassifier(
    max_depth=5, random_state=42
)
model.fit(X_train, y_train)

predictions = model.predict(X_test)
print(classification_report(y_test, predictions))

plt.figure(figsize=(14, 7))
plot_tree(model, feature_names=X.columns, filled=True, max_depth=3)
plt.show()`,
        qa: [
          { q: "Gini vs entropy?", a: "Both measure node impurity; they usually give very similar trees. Gini is slightly cheaper to compute." },
          { q: "How do you stop a tree overfitting?", a: "Limit max_depth, raise min_samples_leaf/split, or use cost-complexity pruning (ccp_alpha)." },
        ],
      },
      {
        id: "random-forest",
        label: "Random Forest",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = RandomForestClassifier(
    n_estimators=200, random_state=42
)
model.fit(X_train, y_train)

predictions = model.predict(X_test)
print(classification_report(y_test, predictions))`,
        qa: [
          { q: "Why does a random forest beat one tree?", a: "Averaging many decorrelated trees (bootstrap rows + random feature subsets) cuts variance without raising bias much." },
          { q: "Are impurity-based feature importances reliable?", a: "They are biased toward high-cardinality features; cross-check with permutation importance." },
        ],
      },
      {
        id: "svm",
        label: "Support Vector Machine",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.metrics import classification_report

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = make_pipeline(
    StandardScaler(),
    SVC(kernel="rbf", C=1.0, gamma="scale", probability=True),
)
model.fit(X_train, y_train)

predictions = model.predict(X_test)
print(classification_report(y_test, predictions))`,
        qa: [
          { q: "What is the kernel trick?", a: "Computes inner products in a higher-dimensional space implicitly, letting a linear separator fit non-linear boundaries (RBF, polynomial)." },
          { q: "Meaning of C and gamma?", a: "C trades margin width vs misclassification (high C = stricter fit). gamma is the RBF reach: high gamma = tight, wiggly boundaries (overfit risk)." },
        ],
      },
      {
        id: "gradient-boosting",
        label: "XGBoost / Gradient Boosting",
        requires: "pip install xgboost scikit-learn pandas",
        code: `import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"])
y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# for imbalance: scale_pos_weight = n_negative / n_positive
model = XGBClassifier(
    n_estimators=500, learning_rate=0.05, max_depth=4,
    subsample=0.8, colsample_bytree=0.8,
    eval_metric="logloss", early_stopping_rounds=30, random_state=42,
)
model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

proba = model.predict_proba(X_test)[:, 1]
print(classification_report(y_test, model.predict(X_test)))
print("ROC-AUC:", roc_auc_score(y_test, proba))`,
        qa: [
          { q: "Which hyperparameters matter most?", a: "learning_rate with n_estimators (trade off), max_depth, subsample/colsample_bytree, and regularisation (lambda, alpha)." },
          { q: "Why a small learning rate with more trees?", a: "Smaller steps generalise better but need more trees; early stopping picks the right number." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "Clustering & Anomalies",
    icon: "⁂",
    items: [
      {
        id: "kmeans",
        label: "K-Means (Elbow + Silhouette)",
        requires: "pip install scikit-learn matplotlib",
        code: `import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

df = pd.read_csv("data.csv")
X = StandardScaler().fit_transform(df.select_dtypes("number"))

inertia, sil = [], []
ks = range(2, 11)
for k in ks:
    km = KMeans(n_clusters=k, n_init=10, random_state=42).fit(X)
    inertia.append(km.inertia_)
    sil.append(silhouette_score(X, km.labels_))

fig, ax = plt.subplots(1, 2, figsize=(12, 4))
ax[0].plot(ks, inertia, marker="o"); ax[0].set_title("Elbow (inertia)")
ax[1].plot(ks, sil, marker="o");     ax[1].set_title("Silhouette")
plt.show()

best_k = list(ks)[sil.index(max(sil))]
km = KMeans(n_clusters=best_k, n_init=10, random_state=42).fit(X)
df["cluster"] = km.labels_
print(df.groupby("cluster").mean(numeric_only=True))`,
        qa: [
          { q: "How do you pick k?", a: "Elbow of the inertia curve, highest silhouette score, and domain sense." },
          { q: "K-Means limitations?", a: "Assumes spherical, similar-size clusters; sensitive to scaling, outliers and initialisation; you must choose k." },
          { q: "Range of silhouette score?", a: "-1 to 1. Near 1 = well separated, near 0 = overlapping, negative = likely wrong cluster." },
        ],
      },
      {
        id: "dbscan",
        label: "DBSCAN",
        requires: "pip install scikit-learn matplotlib",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("data.csv")
X = StandardScaler().fit_transform(df.select_dtypes("number"))

# choose eps from the k-distance "knee" (k = min_samples)
min_samples = 5
dist, _ = NearestNeighbors(n_neighbors=min_samples).fit(X).kneighbors(X)
plt.plot(np.sort(dist[:, -1]))
plt.ylabel("distance to 5th neighbour")
plt.show()

db = DBSCAN(eps=0.8, min_samples=min_samples).fit(X)
labels = db.labels_                       # -1 = noise
print("Clusters:", len(set(labels)) - (1 if -1 in labels else 0))
print("Noise points:", (labels == -1).sum())`,
        qa: [
          { q: "Advantage over K-Means?", a: "Finds arbitrarily shaped clusters, needs no k, and flags noise points (label -1)." },
          { q: "What do eps and min_samples mean?", a: "eps is the neighbourhood radius; min_samples is how many points inside eps make a core point." },
        ],
      },
      {
        id: "hierarchical",
        label: "Hierarchical Clustering",
        requires: "pip install scikit-learn scipy matplotlib",
        code: `import pandas as pd
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import dendrogram, linkage
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("data.csv")
X = StandardScaler().fit_transform(df.select_dtypes("number"))

Z = linkage(X, method="ward")             # ward minimises variance
plt.figure(figsize=(12, 5))
dendrogram(Z, truncate_mode="lastp", p=30)
plt.title("Dendrogram")
plt.show()

agg = AgglomerativeClustering(n_clusters=4, linkage="ward")
df["cluster"] = agg.fit_predict(X)
print(df["cluster"].value_counts())`,
        qa: [
          { q: "How do you read a dendrogram?", a: "Cut horizontally where vertical lines are long (big merge distance); the number of lines you cut through is the cluster count." },
        ],
      },
      {
        id: "isolation-forest",
        label: "Anomaly Detection (Isolation Forest)",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("data.csv")
X = StandardScaler().fit_transform(df.select_dtypes("number"))

iso = IsolationForest(
    n_estimators=200, contamination=0.02, random_state=42
)
df["anomaly"] = iso.fit_predict(X)          # -1 = anomaly, 1 = normal
df["score"] = iso.decision_function(X)      # lower = more abnormal

print(df["anomaly"].value_counts())
print(df.sort_values("score").head(10))`,
        qa: [
          { q: "Why does Isolation Forest work?", a: "Anomalies are few and different, so random splits isolate them in fewer steps (shorter path length) than normal points." },
          { q: "What is contamination?", a: "Your guess of the fraction of anomalies; it sets the score threshold." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "Evaluation & Tuning",
    icon: "✓",
    items: [
      {
        id: "classification-metrics",
        label: "Confusion Matrix & ROC",
        requires: "pip install scikit-learn matplotlib",
        code: `import matplotlib.pyplot as plt
from sklearn.metrics import (
    confusion_matrix, ConfusionMatrixDisplay, RocCurveDisplay,
    PrecisionRecallDisplay, classification_report, roc_auc_score,
    f1_score, precision_score, recall_score,
)

# model, X_test, y_test come from your earlier training step
y_pred = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

print(classification_report(y_test, y_pred))
print("ROC-AUC:", roc_auc_score(y_test, y_proba))

fig, ax = plt.subplots(1, 3, figsize=(16, 4.5))
ConfusionMatrixDisplay.from_predictions(y_test, y_pred, ax=ax[0], cmap="Blues")
RocCurveDisplay.from_predictions(y_test, y_proba, ax=ax[1])
PrecisionRecallDisplay.from_predictions(y_test, y_proba, ax=ax[2])
plt.tight_layout()
plt.show()

# threshold tuning: trade precision for recall
custom = (y_proba >= 0.3).astype(int)
print("Recall @0.3:", recall_score(y_test, custom))`,
        qa: [
          { q: "Precision vs recall?", a: "Precision = TP / (TP + FP): of predicted positives, how many are right. Recall = TP / (TP + FN): of actual positives, how many you found." },
          { q: "When prefer PR-AUC over ROC-AUC?", a: "On heavily imbalanced data - ROC-AUC can look great because of the many true negatives." },
          { q: "What is F1?", a: "The harmonic mean of precision and recall: 2PR / (P + R)." },
        ],
      },
      {
        id: "regression-metrics",
        label: "Regression Metrics & Residuals",
        requires: "pip install scikit-learn matplotlib numpy",
        code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    mean_absolute_percentage_error,
)

y_pred = model.predict(X_test)

print("MAE :", mean_absolute_error(y_test, y_pred))
print("RMSE:", np.sqrt(mean_squared_error(y_test, y_pred)))
print("MAPE:", mean_absolute_percentage_error(y_test, y_pred))
print("R²  :", r2_score(y_test, y_pred))

residuals = y_test - y_pred
fig, ax = plt.subplots(1, 3, figsize=(16, 4.5))
ax[0].scatter(y_pred, residuals, alpha=0.5)
ax[0].axhline(0, color="red"); ax[0].set_title("Residuals vs predicted")
ax[1].hist(residuals, bins=30); ax[1].set_title("Residual distribution")
ax[2].scatter(y_test, y_pred, alpha=0.5)
ax[2].plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], "r--")
ax[2].set_title("Actual vs predicted")
plt.tight_layout()
plt.show()`,
        qa: [
          { q: "MAE vs RMSE?", a: "MAE is the average absolute error (robust, same units); RMSE squares errors first so large mistakes weigh more." },
          { q: "What should a residual plot look like?", a: "Random scatter around 0 with constant spread. A curve means missing non-linearity; a funnel means heteroscedasticity." },
        ],
      },
      {
        id: "cross-validation",
        label: "Cross-Validation",
        requires: "pip install scikit-learn",
        code: `import pandas as pd
from sklearn.model_selection import cross_val_score, cross_validate, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier

df = pd.read_csv("data.csv")
X, y = df.drop(columns=["target"]), df["target"]

model = RandomForestClassifier(n_estimators=200, random_state=42)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# single metric
scores = cross_val_score(model, X, y, cv=cv, scoring="accuracy")
print(f"Accuracy: {scores.mean():.3f} +/- {scores.std():.3f}")

# multiple metrics + train scores (spot overfitting)
res = cross_validate(
    model, X, y, cv=cv,
    scoring=["accuracy", "f1_macro", "roc_auc"],
    return_train_score=True,
)
print(pd.DataFrame(res).mean().round(3))`,
        qa: [
          { q: "Why use cross-validation?", a: "A single split can be lucky or unlucky; k-fold averages over k splits for a more reliable, lower-variance estimate." },
          { q: "What does a large gap between train and CV score mean?", a: "Overfitting (high variance)." },
        ],
      },
      {
        id: "hyperparameter-tuning",
        label: "GridSearchCV / RandomizedSearchCV",
        requires: "pip install scikit-learn scipy",
        code: `import pandas as pd
from scipy.stats import randint
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV

df = pd.read_csv("data.csv")
X, y = df.drop(columns=["target"]), df["target"]

rf = RandomForestClassifier(random_state=42, n_jobs=-1)

# exhaustive
grid = GridSearchCV(
    rf,
    param_grid={"n_estimators": [100, 300], "max_depth": [5, 10, None]},
    cv=5, scoring="f1_macro", n_jobs=-1,
)
grid.fit(X, y)
print(grid.best_params_, grid.best_score_)

# random sampling: faster over a big space
rand = RandomizedSearchCV(
    rf,
    param_distributions={
        "n_estimators": randint(100, 600),
        "max_depth": randint(3, 20),
        "min_samples_leaf": randint(1, 10),
    },
    n_iter=30, cv=5, scoring="f1_macro", n_jobs=-1, random_state=42,
)
rand.fit(X, y)
best_model = rand.best_estimator_

# with a Pipeline use step__param names, e.g. "clf__max_depth"`,
        qa: [
          { q: "Grid vs random search?", a: "Grid tries every combination (exhaustive, expensive); random samples n_iter combos and often finds equally good settings much faster in large spaces." },
          { q: "How to tune a parameter inside a Pipeline?", a: "Prefix the step name with double underscore, e.g. clf__max_depth." },
        ],
      },
      {
        id: "learning-curve",
        label: "Learning Curve (Bias/Variance)",
        requires: "pip install scikit-learn matplotlib numpy",
        code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import learning_curve

# model, X, y from earlier
sizes, train_sc, val_sc = learning_curve(
    model, X, y, cv=5, scoring="accuracy",
    train_sizes=np.linspace(0.1, 1.0, 8), n_jobs=-1,
)

plt.plot(sizes, train_sc.mean(axis=1), "o-", label="train")
plt.plot(sizes, val_sc.mean(axis=1), "o-", label="validation")
plt.fill_between(sizes,
                 val_sc.mean(1) - val_sc.std(1),
                 val_sc.mean(1) + val_sc.std(1), alpha=0.15)
plt.xlabel("Training examples")
plt.ylabel("Accuracy")
plt.legend()
plt.show()`,
        qa: [
          { q: "Both curves low and close together?", a: "High bias (underfitting) - add features or use a more complex model." },
          { q: "Train high, validation much lower?", a: "High variance (overfitting) - get more data, regularise or simplify." },
        ],
      },
      {
        id: "feature-importance",
        label: "Permutation Importance & SHAP",
        requires: "pip install scikit-learn shap matplotlib",
        code: `import pandas as pd
import matplotlib.pyplot as plt
from sklearn.inspection import permutation_importance

# model, X_test, y_test from earlier
result = permutation_importance(
    model, X_test, y_test, n_repeats=10, random_state=42, n_jobs=-1
)
imp = pd.Series(result.importances_mean, index=X_test.columns)
imp.sort_values().tail(15).plot.barh()
plt.title("Permutation importance")
plt.show()

# SHAP: per-prediction explanations (tree models)
import shap
explainer = shap.TreeExplainer(model)
shap_values = explainer(X_test)
shap.plots.beeswarm(shap_values)
shap.plots.waterfall(shap_values[0])     # explain a single row`,
        qa: [
          { q: "How does permutation importance work?", a: "Shuffle one feature on held-out data and measure how much the score drops; a big drop = important feature." },
          { q: "Why prefer it over built-in tree importances?", a: "It is model-agnostic, computed on unseen data and not biased toward high-cardinality features." },
        ],
      },
      {
        id: "save-load",
        label: "Save & Load Models",
        requires: "pip install scikit-learn joblib",
        code: `import joblib
import pandas as pd

# save the WHOLE pipeline (preprocessing + model)
joblib.dump(model, "model.joblib")

# ---- later / in your FastAPI app ----
model = joblib.load("model.joblib")

new_row = pd.DataFrame([{"age": 30, "city": "Delhi", "salary": 52000}])
print(model.predict(new_row))
print(model.predict_proba(new_row))

# FastAPI sketch:
# @app.post("/predict")
# def predict(item: Item):
#     df = pd.DataFrame([item.model_dump()])
#     return {"prediction": model.predict(df).tolist()}`,
        qa: [
          { q: "Why save the full Pipeline, not just the estimator?", a: "Inference needs the exact same imputing/scaling/encoding that training used; saving only the model forces you to re-create those steps." },
          { q: "Is joblib.load safe on untrusted files?", a: "No - it uses pickle and can execute arbitrary code. Only load files you created or trust." },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    title: "Deep Learning & NLP",
    icon: "✦",
    items: [
      {
        id: "keras-mlp",
        label: "Neural Network (Keras)",
        requires: "pip install tensorflow scikit-learn",
        code: `import pandas as pd
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("data.csv")
X = df.drop(columns=["target"]).values
y = df["target"].values

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
sc = StandardScaler()
X_train, X_test = sc.fit_transform(X_train), sc.transform(X_test)

model = keras.Sequential([
    layers.Input(shape=(X_train.shape[1],)),
    layers.Dense(64, activation="relu"),
    layers.Dropout(0.3),
    layers.Dense(32, activation="relu"),
    layers.Dense(1, activation="sigmoid"),     # binary output
])
model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])

early = keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True)
hist = model.fit(
    X_train, y_train, validation_split=0.2,
    epochs=100, batch_size=32, callbacks=[early], verbose=0,
)
print(model.evaluate(X_test, y_test, verbose=0))`,
        qa: [
          { q: "Output layer + loss for multi-class?", a: "Dense(n_classes, softmax) with sparse_categorical_crossentropy (integer labels) or categorical_crossentropy (one-hot)." },
          { q: "What does Dropout do?", a: "Randomly zeroes a fraction of activations during training so the network can't rely on specific neurons - a regulariser." },
        ],
      },
      {
        id: "pytorch-loop",
        label: "PyTorch Training Loop",
        requires: "pip install torch scikit-learn",
        code: `import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader

device = "cuda" if torch.cuda.is_available() else "cpu"

# X_train, y_train: scaled numpy arrays from earlier
Xt = torch.tensor(X_train, dtype=torch.float32)
yt = torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)
loader = DataLoader(TensorDataset(Xt, yt), batch_size=32, shuffle=True)

model = nn.Sequential(
    nn.Linear(Xt.shape[1], 64), nn.ReLU(), nn.Dropout(0.3),
    nn.Linear(64, 32), nn.ReLU(),
    nn.Linear(32, 1),
).to(device)

loss_fn = nn.BCEWithLogitsLoss()               # includes the sigmoid
opt = torch.optim.Adam(model.parameters(), lr=1e-3)

for epoch in range(30):
    model.train()
    total = 0.0
    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad()                         # 1. clear old gradients
        loss = loss_fn(model(xb), yb)           # 2. forward + loss
        loss.backward()                         # 3. backprop
        opt.step()                              # 4. update weights
        total += loss.item() * len(xb)
    print(epoch, total / len(loader.dataset))

model.eval()
with torch.no_grad():
    probs = torch.sigmoid(model(torch.tensor(X_test, dtype=torch.float32).to(device)))`,
        qa: [
          { q: "Why call optimizer.zero_grad()?", a: "PyTorch accumulates gradients by default; without clearing, each step would add to the previous batch's gradients." },
          { q: "model.train() vs model.eval()?", a: "They toggle layers like Dropout and BatchNorm between training and inference behaviour." },
        ],
      },
      {
        id: "tfidf-text",
        label: "Text Classification (TF-IDF)",
        requires: "pip install scikit-learn pandas",
        code: `import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

df = pd.read_csv("reviews.csv")             # columns: text, label
X_train, X_test, y_train, y_test = train_test_split(
    df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
)

clf = Pipeline([
    ("tfidf", TfidfVectorizer(
        lowercase=True, stop_words="english",
        ngram_range=(1, 2), min_df=2, max_features=20000,
    )),
    ("model", LogisticRegression(max_iter=1000)),
])
clf.fit(X_train, y_train)
print(classification_report(y_test, clf.predict(X_test)))

# top words per class
vec = clf.named_steps["tfidf"]
coef = clf.named_steps["model"].coef_[0]
words = vec.get_feature_names_out()
print("Positive:", words[coef.argsort()[-10:]])
print("Negative:", words[coef.argsort()[:10]])`,
        qa: [
          { q: "What does TF-IDF compute?", a: "Term frequency x inverse document frequency: words frequent in a document but rare across the corpus get high weight." },
          { q: "Why ngram_range=(1, 2)?", a: "Adds bigrams so phrases like 'not good' keep their meaning." },
        ],
      },
    ],
  },
];

export default libraryGroups;