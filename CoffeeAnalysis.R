
setwd("~/Desktop")
coffee <- read.csv('CoffeeData.csv',header = T)
library(ggplot2)
library(deplyr)


## manipulation
attach(coffee)
coffee$Agg.Rating <- rowMeans(coffee[ , c(19,22)], na.rm=TRUE)
coffee$coffee_ID <- seq(1,25)

coffee_ratings <- melt(coffee,id.vars='coffee_ID', measure.vars=c('Alex.Rating','Rebby.Rating','Agg.Rating'))


##plot rating

ggplot(coffee_ratings, aes(x=variable, y=value, color=variable)) +
  geom_boxplot() +
  stat_summary(fun.y=mean, geom="point", shape=8, size=4) +
  geom_dotplot(binaxis='y', stackdir='center', dotsize=.4, shape = 3)


t.test(coffee$Alex.Rating,coffee$Rebby.Rating)



## correlations
ggplot(coffee, aes(x=Price.per.Oz,y=Rebby.Rating)) + geom_point()
correl(Price.per.Oz,Rebby.Rating)

cor(coffee$Price.per.Oz, coffee$Rebby.Rating, use = "complete.obs")
cor(coffee$Price.per.Oz, coffee$Alex.Rating, use = "complete.obs")
cor(coffee$Price.per.Oz, coffee$Agg.Rating, use = "complete.obs")




## cut by segments

coffee_country <- coffee[!(is.na(coffee$Coffee.Origin.Country) | coffee$Coffee.Origin.Country==""), ]
coffee_long <-  melt(coffee,id.vars=c('coffee_ID','Coffee.Origin.Country','Coffee.Origin.Continent','Price.per.Oz','Drinking.Location','Process','Coffee.Producer.Gender','Barista','Elevation', 'Coffee.Roast'), measure.vars=c('Alex.Rating','Rebby.Rating','Agg.Rating'))

dodge <- position_dodge(width = 0.9)
ggplot(coffee_country_long, aes(x = interaction(variable,Coffee.Origin.Continent), y = value, fill = Coffee.Origin.Continent)) +
  geom_bar(stat = "identity", position = position_dodge()) +
  geom_errorbar(aes(ymax = yield + SE, ymin = yield - SE), position = dodge, width = 0.2)

ggplot(coffee_country_long, aes(x=Coffee.Origin.Continent, y = value, fill = Coffee.Origin.Continent, na.rm = TRUE)) + geom_bar(stat = "summary", fun = "mean") + facet_grid(variable~.)

ggplot(coffee_country_long, aes(x=Coffee.Origin.Country, y = value, fill = Coffee.Origin.Continent, na.rm = TRUE)) + geom_bar(stat = "summary", fun = "mean") + facet_grid(variable~.)

ggplot(coffee_long, aes(x=Drinking.Location, y = value, fill = Drinking.Location, na.rm = TRUE)) + geom_bar(stat = "summary", fun = "mean") + facet_grid(variable~.)

ggplot(coffee_long, aes(x=Process, y = value)) + geom_bar(stat = "summary", fun = "mean") + facet_grid(variable~.)

ggplot(coffee_long, aes(x=Coffee.Producer.Gender, y = value)) + geom_bar(stat = "summary", fun = "mean") + facet_grid(variable~.)

ggplot(coffee_long, aes(x=Barista, y = value)) + geom_bar(stat = "summary", fun = "mean") + facet_grid(variable~.)

ggplot(coffee_long[!(is.na(coffee_long$Coffee.Roast) | coffee$Coffee.Roast==""), ], aes(x=Coffee.Roast, y = value)) + geom_bar(stat = "summary", fun = "mean") + facet_grid(variable~.)


ggplot(coffee_long[!(is.na(coffee_long$Coffee.Roast) | coffee$Coffee.Roast==""), ], aes(x=reorder(Coffee.Roast,-value), y = value)) + geom_bar(stat = "summary", fun = "mean") + facet_grid(variable~.)




# need to figure out location
ggplot(coffee_long, aes(x=Elevation, y = value)) + geom_bar(stat = "summary", fun = "mean") + facet_grid(variable~.)




# regression

attach(coffee_long)

model <- lm(Agg.Rating ~ Coffee.Origin.Continent  + Drinking.Location + Process + Coffee.Producer.Gender + Coffee.Roast, data=coffee)

summary(model)


#

install.packages("wordcloud2")
library(wordcloud2)
wordcloud2(coffee$Alex.Tasting.Notes)
