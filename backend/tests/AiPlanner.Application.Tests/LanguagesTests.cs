using System.Globalization;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Application.Notifications.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

/// <summary>The server's own texts exist for every app language (shared/i18n LANGUAGES).</summary>
public class LanguagesTests
{
    public static readonly TheoryData<string> AppLocales = new()
    {
        "es-ES", "fr-FR", "de-DE", "pt-BR", "it-IT", "pl-PL", "uk-UA", "ru-RU", "tr-TR", "he-IL", "ar", "hi-IN", "zh-CN", "ja-JP", "ko-KR",
    };

    [Theory]
    [MemberData(nameof(AppLocales))]
    public void Every_app_language_has_its_own_notification_and_question_texts(string locale)
    {
        var n = NotificationTexts.For(locale);
        n.Should().NotBeSameAs(NotificationTexts.English);
        n.TaskReminder.Should().NotBe(NotificationTexts.English.TaskReminder);
        n.StartsIn(n.Minutes(5)).Should().Contain("5");
        n.TasksDueToday(3).Should().Contain("3");

        var q = ClarificationTexts.For(locale);
        q.Should().NotBeSameAs(ClarificationTexts.English);
        q.WhenIsAppointment.Should().NotBe(ClarificationTexts.English.WhenIsAppointment);
    }

    [Fact]
    public void An_unknown_language_falls_back_to_English()
    {
        NotificationTexts.For("sw-KE").Should().BeSameAs(NotificationTexts.English);
        ClarificationTexts.For(null).Should().BeSameAs(ClarificationTexts.English);
    }

    [Theory]
    [InlineData("pl", 1, "1 minutę")]
    [InlineData("pl", 2, "2 minuty")]
    [InlineData("pl", 5, "5 minut")]
    [InlineData("pl", 12, "12 minut")]
    [InlineData("pl", 22, "22 minuty")]
    [InlineData("uk", 1, "1 хвилину")]
    [InlineData("uk", 3, "3 хвилини")]
    [InlineData("uk", 11, "11 хвилин")]
    [InlineData("uk", 21, "21 хвилину")]
    [InlineData("ar", 1, "دقيقة")]
    [InlineData("ar", 2, "دقيقتين")]
    [InlineData("ar", 3, "3 دقائق")]
    [InlineData("ar", 15, "15 دقيقة")]
    [InlineData("de", 3, "3 Minuten")]
    [InlineData("fr", 0, "0 minute")]
    public void Minutes_take_the_right_plural_form(string language, int minutes, string expected)
    {
        NotificationTexts.For(language).Minutes(minutes).Should().Be(expected);
    }

    [Fact]
    public void Arabic_dates_use_the_gregorian_calendar_and_western_digits()
    {
        var culture = NotificationTexts.Arabic.Culture;
        culture.Calendar.Should().BeOfType<GregorianCalendar>();
        new DateTime(2026, 10, 12, 14, 30, 0).ToString("ddd d MMM, HH:mm", culture).Should().Contain("14:30").And.Contain("12");
    }

    [Theory]
    [InlineData("¿A qué hora empieza la reunión?")]
    [InlineData("Wann genau?")]
    [InlineData("O której godzinie?")]
    [InlineData("几点开始？")]
    [InlineData("何時ですか？")]
    public void A_question_about_the_time_in_any_app_language_stops_the_generic_one(string question)
    {
        var questions = new Questions(ClarificationTexts.English);
        questions.FromProvider(question);
        questions.Ask(ClarificationTexts.English.WhatTimeStarts);
        questions.Count.Should().Be(1);
    }
}
