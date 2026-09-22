export interface Scenario {
  name: string;
  stretches: string;
  href: string;
  tryIt: string;
}

export interface HomePageModel {
  title: string;
  scenarios: Scenario[];
}
